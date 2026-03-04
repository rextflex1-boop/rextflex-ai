// api/chat.js
import OpenAI from 'openai';

// POE API configuration
const POE_API_KEY = process.env.POE_API_KEY;  // Vercel environment variable mein set karo
const POE_BASE_URL = 'https://api.poe.com/v1';

export default async function handler(req, res) {
  // Sirf POST requests allow karo
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const client = new OpenAI({
      apiKey: POE_API_KEY,
      baseURL: POE_BASE_URL,
    });

    const completion = await client.chat.completions.create({
      model: 'claude-3-opus',  // ya jo model POE par available ho
      messages: [{ role: 'user', content: message }],
    });

    const reply = completion.choices[0].message.content;
    res.status(200).json({ reply });
  } catch (error) {
    console.error('POE API error:', error);
    res.status(500).json({ error: 'AI service error' });
  }
}
