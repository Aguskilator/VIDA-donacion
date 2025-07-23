// /api/openai.js
// Vercel/Next.js Serverless Function para proxy seguro a OpenAI

export const config = {
  api: {
    bodyParser: true, // Asegura que req.body esté disponible
  },
};

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
  const { historial, mensaje, model, prompt, temperature, max_tokens, messages } = req.body;

  // Guardar la pregunta del usuario en Supabase (solo si existe)
  let userQuestion = null;
  if (mensaje) {
    userQuestion = mensaje;
  } else if (Array.isArray(messages)) {
    // Busca el último mensaje del usuario
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    if (lastUserMsg) userQuestion = lastUserMsg.content;
  } else if (Array.isArray(historial)) {
    const lastUserMsg = historial.filter(m => m.role === 'user').pop();
    if (lastUserMsg) userQuestion = lastUserMsg.content;
  }

  // Función simple para eliminar posibles nombres y direcciones
  function sanitizeQuestion(text) {
    // Elimina patrones comunes de direcciones (calle, avenida, número, etc.).
    let sanitized = text.replace(/\b(calle|av[.]?|avenida|número|num[.]?|#|cp|código postal|colonia|piso|departamento|dpto|apto|urbanización|barrio|manzana|lote|localidad|municipio|provincia|ciudad|estado|país)\b.*?(\s|$)/gi, '');
    // Elimina secuencias que parecen nombres propios.
    sanitized = sanitized.replace(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/g, '[nombre]');
    return sanitized;
  }

  if (userQuestion) {
    try {
      const now = new Date().toISOString();
      const cleanQuestion = sanitizeQuestion(userQuestion);
      const { data, error } = await supabase.from('vida-app').insert({ question: cleanQuestion, created_at: now });
      console.log('Supabase insert response:', { data, error });
      if (error) {
        console.error('Error guardando pregunta en Supabase:', error.message);
      }
    } catch (err) {
      // No interrumpir el flujo si falla el guardado
      console.error('Error guardando pregunta en Supabase (catch):', err.message);
    }
  }

  // Prompt del sistema mejorado para respuestas más naturales y cierres variados
  const systemPrompt = `
Eres VIDA, un asistente virtual experto en donación de órganos y tejidos en España. Responde de forma cálida, natural y variada, adaptando tu estilo a cada usuario.

- Evita sonar repetitivo o robótico, especialmente en los cierres de cada mensaje.
- No uses siempre las mismas frases para terminar la conversación. Varía tus despedidas o, si la conversación lo permite, simplemente responde sin cerrar.
- Si el usuario sigue preguntando, responde de forma fluida y natural, como lo haría una persona real.
- No repitas la pregunta del usuario. No uses asteriscos bajo ningun motivo ni viñetas; si necesitas listas, usa numeración o guiones.
- Si la pregunta está fuera de alcance, responde exactamente: "Lo siento, solo puedo ayudarte con preguntas sobre donación de órganos y tejidos en España."
- Si el usuario pide más información, amplía la respuesta de forma clara y sencilla.

Recuerda: tu objetivo es sonar humano, cercano y variado, especialmente al cerrar cada respuesta.
`;

  // Construir el array de mensajes para OpenAI
  let finalMessages = [
    { role: 'system', content: systemPrompt }
  ];

  // Compatibilidad con todos los formatos
  if (Array.isArray(messages)) {
    // Nuevo formato: { messages: [...] }
    finalMessages = messages;
  } else if (Array.isArray(prompt)) {
    // Formato alternativo: { prompt: [...] }
    finalMessages = prompt;
  } else if (Array.isArray(historial)) {
    // Formato nuevo: { historial: [...], mensaje: 'texto' }
    finalMessages = finalMessages.concat(historial);
    if (mensaje) {
      finalMessages.push({ role: 'user', content: mensaje });
    }
  }

  const openaiPayload = {
    model: model || 'gpt-4o',
    messages: finalMessages,
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
