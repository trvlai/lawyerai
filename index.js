import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory session tracking
const chatHistories = {};
const userLocations = {};
const awaitingCountryPrompt = {};

function detectGreeklish(text) {
  const greeklishPattern = /(?:th|ps|ks|ch|tz|mp|g|n|k|l|x|z|v|f|d|t|s|r|m|p|b|a|e|i|o|u|y|h){4,}/i;
  return greeklishPattern.test(text) && /[aeiou]/i.test(text); // Has vowels
}

app.post('/api/chat', async (req, res) => {
  const { message, userId } = req.body;

  if (!message || !userId) {
    return res.status(400).json({ reply: "Missing message or userId" });
  }

  // Initialize user session
  if (!chatHistories[userId]) {
    chatHistories[userId] = [];
    awaitingCountryPrompt[userId] = true;

    // Add opening greeting messages only on first interaction
    chatHistories[userId].push({
      role: "assistant",
      content: "Hello😊! I'm Moouris, your AI legal assistant. My replies are for general information only and shouldn’t be considered legal advice.",
    });
    chatHistories[userId].push({
      role: "assistant",
      content: "How can I help you with your legal questions today?",
    });

    return res.json({
      reply: "Hello😊! I'm Moouris, your AI legal assistant. My replies are for general information only and shouldn’t be considered legal advice.\n\nHow can I help you with your legal questions today?",
    });
  }

  // Store message
  chatHistories[userId].push({ role: 'user', content: message });

  // Country detection
  if (awaitingCountryPrompt[userId] && !userLocations[userId]) {
    const lower = message.toLowerCase();

    const countryMatch = lower.match(/\b(?:cyprus|greece|uk|united kingdom|usa|united states|india|uae|germany|canada|australia|france|italy|spain|netherlands|ireland|turkey)\b/i);
    if (countryMatch) {
      userLocations[userId] = countryMatch[0];
      awaitingCountryPrompt[userId] = false;
    } else {
      awaitingCountryPrompt[userId] = false; // Don't block convo
    }
  }

  // 🧠 Construct system prompt
  let systemPrompt = `You are Moouris, a helpful, and knowledgeable AI legal assistant.

- You do not say you're an AI.
- You act like a professional legal representative.
- Your tone is confident, approachable, and human-like — never robotic.
- Keep answers short, clear, and to the point, using simple language.
- Ask relevant follow-up questions when needed to fully understand the user's situation, like a good legal assistant would.
- Never answer questions you don't fully understand — always seek clarification politely if needed.
- Avoid disclaimers unless specifically asked.
- Do not give long paragraphs. Keep replies conversational and broken into short blocks.
`;

  // 🌍 If location known, tailor answers
  if (userLocations[userId]) {
    systemPrompt += `\n\nGive legal guidance based on laws in ${userLocations[userId]}.`;
  }

  // 🧠 Greeklish handling
  if (detectGreeklish(message)) {
    systemPrompt += `\n\nThe user's input is in Greek written with Latin letters (Greeklish). Please understand it as Greek and reply in proper Greek.`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistories[userId],
      ],
    });

    const reply = completion.choices[0].message.content;

    // Store AI reply
    chatHistories[userId].push({ role: 'assistant', content: reply });

    res.json({ reply });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ reply: 'Something went wrong.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
