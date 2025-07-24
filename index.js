const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory storage (replace with DB in production)
const chatHistories = {};
const userLocations = {};
const awaitingCountryPrompt = {};

app.post('/api/chat', async (req, res) => {
  const { message, userId } = req.body;

  if (!message || !userId) {
    return res.status(400).json({ reply: "Missing message or userId" });
  }

  // Initialize user state
  if (!chatHistories[userId]) {
    chatHistories[userId] = [];
    awaitingCountryPrompt[userId] = true;
  }

  const isFirstUserMessage = chatHistories[userId].filter(m => m.role === 'user').length === 0;

  // Check if we’re waiting for country input
  if (awaitingCountryPrompt[userId] && !userLocations[userId]) {
    const detectedCountry = detectCountryFromMessage(message);
    if (detectedCountry) {
      userLocations[userId] = detectedCountry;
      awaitingCountryPrompt[userId] = false;
    } else {
      awaitingCountryPrompt[userId] = false; // Stop waiting even if not provided
    }
  }

  // Save user message
  chatHistories[userId].push({ role: 'user', content: message });

  // System prompt with optional location
  const country = userLocations[userId];
  let systemPrompt = `You are Moouris, a helpful, friendly, and knowledgeable AI legal assistant.

- You do not say you're an AI.
- You act like a professional legal representative.
- Your tone is confident, approachable, and human-like — never robotic.
- Keep answers short, clear, and to the point, using simple language.
- Ask relevant follow-up questions when needed to fully understand the user's situation, like a good legal assistant would.
- Never answer questions you don't fully understand — always seek clarification politely if needed.
- Avoid disclaimers unless specifically asked.
- Do not give long paragraphs. Keep replies conversational and broken into short blocks.`;

  if (country) {
    systemPrompt += `\n\nTailor all legal answers to the laws and practices of ${country}.`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatHistories[userId]
      ],
    });

    let reply = completion.choices[0].message.content;

    // Ask for location at end of first reply if none is known
    if (isFirstUserMessage && !country) {
      reply += "\n\nBefore we continue, could you let me know which country you're in? Laws can differ quite a bit depending on location.";
    }

    // Save AI reply
    chatHistories[userId].push({ role: 'assistant', content: reply });

    res.json({ reply });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ reply: "Something went wrong." });
  }
});

// Simple keyword matching for demo purposes
function detectCountryFromMessage(message) {
  const countries = [
    "United States", "USA", "Canada", "UK", "United Kingdom", "Germany", "France", "Italy",
    "Spain", "India", "Australia", "South Africa", "Cyprus", "UAE", "Dubai", "Greece", "Mexico"
  ];
  const lowerMsg = message.toLowerCase();
  for (const country of countries) {
    if (lowerMsg.includes(country.toLowerCase())) {
      return country;
    }
  }
  return null;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
