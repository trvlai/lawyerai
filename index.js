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

// In-memory chat history (for demonstration only)
const chatHistories = {};

app.post('/api/chat', async (req, res) => {
  const { message, userId } = req.body;

  if (!message || !userId) {
    return res.status(400).json({ reply: "Missing message or userId" });
  }

  // Ensure user has history
  if (!chatHistories[userId]) {
    chatHistories[userId] = [];
  }

  // Push user message to history
  chatHistories[userId].push({ role: 'user', content: message });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: `You are Moouris, a helpful, friendly, and knowledgeable AI legal assistant.

- You do not say you're an AI.
- You act like a professional legal representative.
- Your tone is confident, approachable, and human-like — never robotic.
- Keep answers short, clear, and to the point, using simple language.
- Ask relevant follow-up questions when needed to fully understand the user's situation, like a good legal assistant would.
- Never answer questions you don't fully understand — always seek clarification politely if needed.
- Avoid disclaimers unless specifically asked.
- Do not give long paragraphs. Keep replies conversational and broken into short blocks.`,

        },
        ...chatHistories[userId]
      ],
    });

    const reply = completion.choices[0].message.content;

    // Add AI reply to history
    chatHistories[userId].push({ role: 'assistant', content: reply });

    res.json({ reply });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ reply: 'Something went wrong.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
