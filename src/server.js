import express from 'express';
import 'dotenv/config.js';
import { aiChatComplete } from './groqEndpoint.js';

const app = express();
const PORT = process.env.PORT || 3000; // matches what main.js posts to

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Server is running',
    status: 'ok'
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/ask', async (req, res) => {
  const prompt = (req.body?.question || req.body?.prompt || '').trim();

  console.log(JSON.stringify(req.body));
  if (!prompt) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    console.log(`body: ${JSON.stringify(req.body)}, prompt: ${req.body.question}`);
    const reply = await aiChatComplete(prompt);
    return res.json({ reply: reply });
  } catch (error) {
    console.error('Ask route error:', error);
    return res.status(500).json({
      error: 'Failed to generate an answer',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});