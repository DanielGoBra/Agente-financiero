import type { APIRoute } from 'astro';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { env } from 'cloudflare:workers';

const businessValidationSchema: Schema = {
  type: Type.ARRAY,
  description: "A list of evaluated businesses",
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      isMicroSME: {
        type: Type.BOOLEAN,
        description: "True if this is a micro-enterprise, SME, or independent business. False if it is a large corporation, franchise, or chain."
      },
      reliabilityScore: {
        type: Type.INTEGER,
        description: "A score from 1 to 10 indicating how confident we are in the data and that it is an active, real business."
      },
      reasoning: {
        type: Type.STRING,
        description: "A brief sentence in Spanish explaining the analysis and profile of the business."
      },
      opportunityScore: {
        type: Type.INTEGER,
        description: "A score from 1 to 100 indicating credit suitability (higher = better lead). Active local businesses with decent ratings but clear financial needs score higher."
      },
      estimatedSize: {
        type: Type.STRING,
        enum: ["micro", "small", "medium"],
        description: "Estimated business size category based on names, business types, and online signal."
      },
      predictedNeed: {
        type: Type.STRING,
        description: "Likely financial need in Spanish (e.g., 'Compra de inventario', 'Capital de trabajo', 'Maquinaria y herramientas', 'Adecuación de local')."
      },
      digitalFootprint: {
        type: Type.STRING,
        enum: ["low", "medium", "high"],
        description: "Digital presence level based on rating count and website availability."
      }
    },
    required: ["id", "isMicroSME", "reliabilityScore", "reasoning", "opportunityScore", "estimatedSize", "predictedNeed", "digitalFootprint"]
  }
};

export const POST: APIRoute = async ({ request }) => {
  const getEnv = (key: string): string => {
    return (env as any)[key] || '';
  };

  try {
    const { businesses } = await request.json();
    
    if (!businesses || !Array.isArray(businesses)) {
      return new Response(JSON.stringify({ error: "Invalid businesses data" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (businesses.length === 0) {
      return new Response(JSON.stringify({ validations: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let validations: any[] = [];
    let success = false;
    let lastError: any = null;

    // Check if OpenRouter is configured
    const openrouterKey = getEnv('OPENROUTER_API_KEY');
    const openrouterModel = getEnv('OPENROUTER_MODEL') || "meta-llama/llama-3.1-8b-instruct:free";

    if (openrouterKey && openrouterKey !== "YOUR_OPENROUTER_API_KEY" && openrouterKey !== "") {
      try {
        console.log(`Intentando validación con OpenRouter usando modelo: ${openrouterModel}...`);
        
        const openRouterPrompt = `
Eres un agente inteligente de riesgo de crédito y captación de clientes PYME para una Fintech en Colombia.
Tengo una lista de negocios extraídos de Google Maps.
Tu objetivo es evaluar detalladamente cada negocio y clasificarlo para nuestro pipeline de ventas.

Reglas de clasificación:
1. Filtra y marca 'isMicroSME' como FALSE para grandes corporaciones, franquicias multinacionales, cadenas nacionales (ej. Éxito, Bancolombia, McDonald's, D1, Ara, Justo & Bueno, Farmatodo, etc.) y oficinas corporativas.
2. Identifica si es micro, pequeña o mediana empresa (MIPYME) local o independiente.
3. Evalúa la oportunidad crediticia ('opportunityScore' de 1 a 100):
   - Negocios estables con flujo de caja diario (ej. restaurantes, panaderías, tiendas de barrio, talleres, ferreterías) tienen alta oportunidad (80-100).
   - Negocios muy nuevos o sin reseñas tienen menor puntuación (30-60).
   - Los no-pymes obtienen 0.
4. Identifica su necesidad financiera típica en español:
   - Ferreterías, tiendas: 'Compra de inventario'
   - Talleres de motos, peluquerías: 'Maquinaria y herramientas'
   - Restaurantes, panaderías: 'Adecuación de local' o 'Capital de trabajo'
   - En general, deduce según el tipo de negocio.
5. Determina la huella digital ('low' si no tiene website y tiene pocas reseñas, 'medium' si tiene buena cantidad de reseñas, 'high' si tiene website propio y alta interacción).

IMPORTANTE: El campo 'reasoning' debe ser redactado en Español de forma muy breve e ilustrativa.

Debes retornar obligatoriamente un objeto JSON que contenga un arreglo 'validations' con el siguiente formato exacto por cada negocio (NO devuelvas ninguna introducción o texto adicional, solo el objeto JSON):
{
  "validations": [
    {
      "id": "id_del_negocio",
      "isMicroSME": true o false,
      "reliabilityScore": entero del 1 al 10,
      "reasoning": "Explicación breve en español",
      "opportunityScore": entero del 1 al 100,
      "estimatedSize": "micro" o "small" o "medium",
      "predictedNeed": "Detalle de necesidad financiera en español",
      "digitalFootprint": "low" o "medium" o "high"
    }
  ]
}

Por favor evalúa cada negocio en esta lista:
${JSON.stringify(businesses.map((b: any) => ({
  id: b.id,
  name: b.name,
  types: b.types,
  website: b.website,
  rating: b.rating,
  address: b.address
})), null, 2)}`;

        const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:4321",
            "X-Title": "Agente Financiero PYME"
          },
          body: JSON.stringify({
            model: openrouterModel,
            messages: [
              { role: "system", content: "Eres un analista de datos experto y asistente de riesgo que devuelve solo formato JSON conforme a las especificaciones dadas." },
              { role: "user", content: openRouterPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2
          })
        });

        if (!orResponse.ok) {
          throw new Error(`OpenRouter API error: ${orResponse.statusText} (${orResponse.status})`);
        }

        const orData = await orResponse.json();
        const contentText = orData.choices?.[0]?.message?.content;
        
        if (contentText) {
          const start = contentText.indexOf("{");
          const end = contentText.lastIndexOf("}");
          let jsonString = contentText;
          if (start !== -1 && end !== -1 && end > start) {
            jsonString = contentText.substring(start, end + 1);
          }
          
          const parsed = JSON.parse(jsonString);
          validations = Array.isArray(parsed) 
            ? parsed 
            : (parsed.validations && Array.isArray(parsed.validations)) 
              ? parsed.validations 
              : [];
          
          if (validations.length > 0) {
            success = true;
            console.log(`Validación exitosa con OpenRouter (${openrouterModel})`);
          }
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Fallo en OpenRouter, recurriendo a Gemini:`, err.message || err);
      }
    }

    // Fallback to Gemini if OpenRouter is not set or fails
    if (!success) {
      const geminiKey = getEnv('GEMINI_API_KEY');
      if (!geminiKey) {
        throw new Error('No hay API keys configuradas. Configura OPENROUTER_API_KEY o GEMINI_API_KEY como secrets en Cloudflare Workers.');
      }
      const ai = new GoogleGenAI({ 
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const geminiPrompt = `
Eres un agente inteligente de riesgo de crédito y captación de clientes PYME para una Fintech en Colombia.
Tengo una lista de negocios extraídos de Google Maps.
Tu objetivo es evaluar detalladamente cada negocio y clasificarlo para nuestro pipeline de ventas.

Reglas de clasificación:
1. Filtra y marca 'isMicroSME' como FALSE para grandes corporaciones, franquicias multinacionales, cadenas nacionales (ej. Éxito, Bancolombia, McDonald's, D1, Ara, Justo & Bueno, Farmatodo, etc.) y oficinas corporativas.
2. Identifica si es micro, pequeña o mediana empresa (MIPYME) local o independiente.
3. Evalúa la oportunidad crediticia ('opportunityScore' de 1 a 100):
   - Negocios estables con flujo de caja diario (ej. restaurantes, panaderías, tiendas de barrio, talleres, ferreterías) tienen alta oportunidad (80-100).
   - Negocios muy nuevos o sin reseñas tienen menor puntuación (30-60).
   - Los no-pymes obtienen 0.
4. Identifica su necesidad financiera típica en español:
   - Ferreterías, tiendas: 'Compra de inventario'
   - Talleres de motos, peluquerías: 'Maquinaria y herramientas'
   - Restaurantes, panaderías: 'Adecuación de local' o 'Capital de trabajo'
   - En general, deduce según el tipo de negocio.
5. Determina la huella digital ('low' si no tiene website y tiene pocas reseñas, 'medium' si tiene buena cantidad de reseñas, 'high' si tiene website propio y alta interacción).

IMPORTANTE: El campo 'reasoning' debe ser redactado en Español de forma muy breve e ilustrativa.

Por favor evalúa cada negocio en esta lista JSON y retorna el esquema de validación:
${JSON.stringify(businesses.map((b: any) => ({
  id: b.id,
  name: b.name,
  types: b.types,
  website: b.website,
  rating: b.rating,
  address: b.address
})), null, 2)}`;

      const modelsToTry = ["gemini-3.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
      let response;

      for (const model of modelsToTry) {
        let retries = 2;
        let delay = 2000;
        
        for (let i = 0; i < retries; i++) {
          try {
            console.log(`Intentando validación con modelo Gemini ${model} (intento ${i + 1}/2)...`);
            response = await ai.models.generateContent({
              model: model,
              contents: geminiPrompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: businessValidationSchema,
                temperature: 0.2
              }
            });
            success = true;
            break;
          } catch (err: any) {
            lastError = err;
            const errMsg = err.message || String(err);
            console.warn(`Error con modelo Gemini ${model} en intento ${i + 1}/2:`, errMsg);
            
            if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("429") || errMsg.includes("demand")) {
              await new Promise(r => setTimeout(r, delay));
              delay *= 1.5;
            } else {
              break;
            }
          }
        }
        if (success) {
          console.log(`Validación exitosa con modelo Gemini: ${model}`);
          const textOutput = response?.text;
          if (textOutput) {
            const parsed = JSON.parse(textOutput);
            validations = Array.isArray(parsed) ? parsed : parsed.validations || [];
          }
          break;
        }
      }
    }

    if (!success) {
      throw lastError || new Error("No se pudo completar la validación con ningún proveedor (OpenRouter / Gemini) debido a cuota agotada.");
    }

    return new Response(JSON.stringify({ validations }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Error validating businesses:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to validate businesses" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
