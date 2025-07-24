import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const chatHistories = {};
const userLocations = {};
const awaitingCountryPrompt = {};

app.post('/api/chat', async (req, res) => {
  const { message, userId } = req.body;
  if (!message || !userId) return res.status(400).json({ reply: "Missing message or userId" });

  if (!chatHistories[userId]) {
    chatHistories[userId] = [];
    awaitingCountryPrompt[userId] = true;
  }

  if (awaitingCountryPrompt[userId] && !userLocations[userId]) {
    const detectedCountry = detectCountryFromMessage(message);
    if (detectedCountry) {
      userLocations[userId] = detectedCountry;
    }
    awaitingCountryPrompt[userId] = false;
  }

  const isFirstUserMessage = chatHistories[userId].length === 0;
  chatHistories[userId].push({ role: 'user', content: message });

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
        { role: "system", content: systemPrompt },
        ...chatHistories[userId],
      ],
    });

    let reply = completion.choices[0].message.content;

    if (isFirstUserMessage && !country) {
      reply += "\n\nBefore we continue, could you let me know which country you're in? Laws can differ quite a bit depending on location.";
    }

    chatHistories[userId].push({ role: 'assistant', content: reply });
    res.json({ reply });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ reply: 'Something went wrong.' });
  }
});

function detectCountryFromMessage(message) {
  const countries = [
    "United States", "USA", "Canada", "UK", "United Kingdom", "Germany", "France",
    "Italy", "Spain", "India", "Australia", "South Africa", "Cyprus", "UAE", "Dubai", "Greece", "Mexico"
  ];
  const lower = message.toLowerCase();
  return countries.find(c => lower.includes(c.toLowerCase())) || null;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
