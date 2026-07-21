// NutriApp — Worker de análisis (Cloudflare)
// Recibe una FOTO {image, mime} o un TEXTO {text} y se lo pasa a Gemini,
// devolviendo { nombre, kcal, carbohidratos_g, proteinas_g, grasas_g, fibra_g, confianza }.
// La clave de Gemini se guarda como SECRETO llamado GEMINI_KEY (no va en el código).

const MODEL = "gemini-2.5-flash"; // si diera error de modelo, prueba "gemini-2.0-flash"

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return json({ error: "Usa POST" }, 405, cors);

    try {
      const { image, mime, text } = await request.json();
      if (!image && !text) return json({ error: "Falta la imagen o el texto" }, 400, cors);

      const base =
        "Eres un nutricionista. Devuelve valores nutricionales realistas en español, " +
        "teniendo en cuenta el aceite y la forma de cocinado. Da un nombre corto para el conjunto. ";

      let parts;
      if (image) {
        parts = [
          { text: base + "Mira la foto de comida e identifica lo que hay. Estima los valores TOTALES de la RACIÓN que se ve en la imagen (no por 100 g)." },
          { inline_data: { mime_type: mime || "image/jpeg", data: image } },
        ];
      } else {
        parts = [
          { text: base + "El usuario describe lo que ha comido: \"" + String(text).slice(0, 500) + "\". " +
                  "Estima los valores nutricionales TOTALES de todo lo descrito, sumando las cantidades indicadas (p. ej. '2 pechugas de pavo con un muslo de pollo')." },
        ];
      }

      const body = {
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              nombre: { type: "STRING" },
              kcal: { type: "NUMBER" },
              carbohidratos_g: { type: "NUMBER" },
              proteinas_g: { type: "NUMBER" },
              grasas_g: { type: "NUMBER" },
              fibra_g: { type: "NUMBER" },
              confianza: { type: "STRING" }, // alta | media | baja
            },
            required: ["nombre", "kcal", "carbohidratos_g", "proteinas_g", "grasas_g"],
          },
        },
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_KEY,
        },
        body: JSON.stringify(body),
      });

      const data = await r.json();
      if (!r.ok) return json({ error: "Error de Gemini", detail: data }, 502, cors);

      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      let parsed;
      try { parsed = JSON.parse(txt); }
      catch { parsed = { nombre: "No reconocido", kcal: 0, carbohidratos_g: 0, proteinas_g: 0, grasas_g: 0, confianza: "baja" }; }

      return json(parsed, 200, cors);
    } catch (e) {
      return json({ error: String(e) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
