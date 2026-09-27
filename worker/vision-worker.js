// NutriApp — Worker de análisis (Cloudflare Workers AI)
// Recibe una FOTO {image, mime} o un TEXTO {text} y devuelve
// { nombre, kcal, carbohidratos_g, proteinas_g, grasas_g, fibra_g, confianza }.
//
// Antes este Worker llamaba a la API de Gemini en modo gratuito. Los términos
// de Google (ai.google.dev/gemini-api/terms) dicen literalmente:
// "You may use only Paid Services when making API Clients available to users
// in the European Economic Area, Switzerland, or the United Kingdom."
// Como esta app sirve a usuarios en España (UE), el nivel gratuito de Gemini
// no estaba permitido para este caso de uso, aunque funcionara técnicamente.
//
// Ahora usa Workers AI (el motor de IA del propio Cloudflare), en la misma
// cuenta donde corre el Worker. Cuota gratuita diaria de 10.000 "neuronas",
// sin restricción geográfica de la UE y sin caducidad de prueba. Modelos e
// input/output verificados contra la documentación oficial de Cloudflare
// (developers.cloudflare.com/workers-ai/models/) el 27/09/2026:
//   - Visión: @cf/llava-hf/llava-1.5-7b-hf (activo, en beta)
//     input:  { image: number[] (bytes 0-255), prompt: string, max_tokens }
//     output: { description: string }
//   - Texto:  @cf/meta/llama-3.2-1b-instruct (activo, ligero y barato)
//     input:  { messages: [{role, content}, ...] }
//     output: { response: string }
// Si en el futuro Cloudflare retira/renombra alguno (pasa de vez en cuando),
// el error se verá claro en la respuesta del Worker: revisa Workers AI →
// Models en el dashboard y actualiza el slug correspondiente aquí.
//
// PASO PREVIO OBLIGATORIO (una sola vez, en el panel de Cloudflare):
//  1. Workers & Pages → tu Worker (nutriapp-vision) → Settings → Bindings
//  2. Add binding → "Workers AI" → nombre de variable: AI
//  3. Guarda y despliega (redeploy)
// Sin ese binding, `env.AI` no existe y el Worker devolverá un error claro.
// El secreto GEMINI_KEY ya no se usa y se puede borrar de las Settings.

const MODEL_VISION = "@cf/llava-hf/llava-1.5-7b-hf";
const MODEL_TEXT = "@cf/meta/llama-3.2-1b-instruct";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "Usa POST" }, 405, cors);

    if (!env.AI) {
      return json(
        { error: "Falta el binding 'AI' de Workers AI. Añádelo en Settings → Bindings del Worker." },
        500,
        cors
      );
    }

    try {
      const { image, mime, text, models } = await request.json();

      // Modo diagnóstico: confirma qué modelos usa este Worker y si el
      // binding de Workers AI está disponible (ya no consulta Gemini).
      if (models) {
        return json(
          { binding_ai: true, modelo_vision: MODEL_VISION, modelo_texto: MODEL_TEXT },
          200,
          cors
        );
      }

      if (!image && !text) return json({ error: "Falta la imagen o el texto" }, 400, cors);

      const instruccion =
        "Eres un nutricionista. Analiza " +
        (image ? "la foto de comida" : "la descripción") +
        " y responde EXCLUSIVAMENTE con un JSON válido (sin texto extra, sin markdown, " +
        "sin explicaciones) con esta forma exacta: " +
        '{"nombre":"string corto","kcal":number,"carbohidratos_g":number,"proteinas_g":number,' +
        '"grasas_g":number,"fibra_g":number,"confianza":"alta|media|baja"}. ' +
        "Da valores TOTALES de la ración (no por 100 g), en español, realistas, " +
        "teniendo en cuenta el aceite y la forma de cocinado.";

      let rawText;
      if (image) {
        const bytes = base64ToBytes(image);
        const out = await env.AI.run(MODEL_VISION, {
          image: Array.from(bytes),
          prompt: instruccion,
          max_tokens: 512,
        });
        rawText = out.description;
      } else {
        const out = await env.AI.run(MODEL_TEXT, {
          messages: [
            { role: "system", content: instruccion },
            { role: "user", content: String(text).slice(0, 500) },
          ],
        });
        rawText = out.response;
      }

      const parsed = extractJson(rawText) || {
        nombre: "No reconocido",
        kcal: 0,
        carbohidratos_g: 0,
        proteinas_g: 0,
        grasas_g: 0,
        fibra_g: 0,
        confianza: "baja",
      };
      parsed.modelo = image ? MODEL_VISION : MODEL_TEXT;
      return json(parsed, 200, cors);
    } catch (e) {
      return json({ error: String(e) }, 500, cors);
    }
  },
};

// Los modelos de texto libre a veces envuelven el JSON en ```json ... ``` o
// añaden alguna frase antes/después. Esto intenta rescatar el objeto igualmente.
function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    const m = String(text).match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
