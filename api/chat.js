// api/chat.js
export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, model } = req.body;
  if (!messages || !model) {
    return res.status(400).json({ error: 'Missing messages or model' });
  }

  const API_KEY = process.env.SAMBANOVA_API_KEY;  // set in Vercel environment
  // Correct SambaNova endpoint (check their docs)
  const API_URL = 'https://api.sambanova.ai/v1/chat/completions';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SambaNova API error:', response.status, errorText);
      return res.status(response.status).json({ error: `API error: ${response.status}` });
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;
    res.status(200).json({ reply });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
