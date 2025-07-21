// /api/tts.js
// Endpoint seguro para OpenAI TTS (voz "fable")

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta la API key de OpenAI en el servidor.' });
    return;
  }

  const { input, model, voice } = req.body;
  if (!input || !model || !voice) {
    res.status(400).json({ error: 'Faltan parámetros requeridos (input, model, voice).' });
    return;
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input,
        model,
        voice
      })
    });
    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      res.status(openaiRes.status).json({ error: errorText });
      return;
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    const buffer = await openaiRes.arrayBuffer();
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: 'Error al conectar con OpenAI.', details: err.message });
  }
}
