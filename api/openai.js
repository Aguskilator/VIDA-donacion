// /api/openai.js
// Vercel/Next.js Serverless Function para proxy seguro a OpenAI

export const config = {
  api: {
    bodyParser: true, // Asegura que req.body esté disponible
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

  // --- LÓGICA COMPATIBLE CON EL FRONTEND ---
  // Espera tanto el formato nuevo como el actual del frontend
  const { historial, mensaje, model, prompt, temperature, max_tokens } = req.body;

  // Prompt del sistema mejorado para respuestas más naturales y cierres variados
  const systemPrompt = `
Eres VIDA, un asistente virtual experto en donación de órganos y tejidos en España. Responde de forma cálida, natural y variada, adaptando tu estilo a cada usuario.

- Evita sonar repetitivo o robótico, especialmente en los cierres de cada mensaje.
- No uses siempre las mismas frases para terminar la conversación. Varía tus despedidas o, si la conversación lo permite, simplemente responde sin cerrar.
- Si el usuario sigue preguntando, responde de forma fluida y natural, como lo haría una persona real.
- No repitas la pregunta del usuario. No uses asteriscos ni viñetas; si necesitas listas, usa numeración o guiones.
- Si la pregunta está fuera de alcance, responde exactamente: "Lo siento, solo puedo ayudarte con preguntas sobre donación de órganos y tejidos en España."
- Si el usuario pide más información, amplía la respuesta de forma clara y sencilla.

Recuerda: tu objetivo es sonar humano, cercano y variado, especialmente al cerrar cada respuesta.
`;

  // Construir el array de mensajes para OpenAI
  let messages = [
    { role: 'system', content: systemPrompt }
  ];
  
  // Compatibilidad con ambos formatos
  if (Array.isArray(prompt)) {
    // Formato actual del frontend: { prompt: [...] }
    messages = prompt;
  } else if (Array.isArray(historial)) {
    // Formato nuevo: { historial: [...], mensaje: 'texto' }
    messages = messages.concat(historial);
    if (mensaje) {
      messages.push({ role: 'user', content: mensaje });
    }
  }

  const openaiPayload = {
    model: model || 'gpt-4o',
    messages,
    temperature: temperature || 0.7,
    max_tokens: max_tokens || 700
  };

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(openaiPayload)
    });
    const data = await openaiRes.json();
    if (!openaiRes.ok) {
      res.status(openaiRes.status).json({ error: data.error?.message || 'Error de OpenAI', openaiError: data });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al conectar con OpenAI.', details: err.message });
  }
}
