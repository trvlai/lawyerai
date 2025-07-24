// Import required modules
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env (only useful in dev/local)

// Import OpenAI SDK
const { OpenAI } = require('openai'); // ✅ Make sure you have version >= 4.x installed

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json()); // Middleware to parse incoming JSON

// ✅ Initialize OpenAI client with your secret key from Render environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This must match the key set in Render
});

// POST /api/chat endpoint
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;

  // Input validation
  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ reply: 'Invalid message input.' });
  }

  try {
    // Send chat completion request to OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4', // or 'gpt-3.5-turbo' if needed
      messages: [{ role: 'user', content: userMessage }],
    });

    // Extract and send the assistant's reply
    const reply = response.choices?.[0]?.message?.content?.trim();
    res.json({ reply: reply || 'No response generated.' });
  } catch (error) {
    // Detailed logging to help debug on Render
    console.error('OpenAI Error:', error?.response?.data || error.message || error);
    res.status(500).json({ reply: 'Something went wrong with OpenAI request.' });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
