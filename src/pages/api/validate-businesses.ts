import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

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

    const openrouterKey = getEnv('OPENROUTER_API_KEY');
    const openrouterModel = getEnv('OPENROUTER_MODEL') || "meta-llama/llama-3.1-8b-instruct:free";

    if (!openrouterKey) {
      return new Response(JSON.stringify({ 
        error: "OPENROUTER_API_KEY no está configurada en los secrets de Cloudflare Workers." 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Validando ${businesses.length} negocios con OpenRouter (${openrouterModel})...`);
        
    const prompt = `
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
        "HTTP-Referer": "https://agente-financiero.danelgomez-mgvc.workers.dev",
        "X-Title": "Agente Financiero PYME"
      },
      body: JSON.stringify({
        model: openrouterModel,
        messages: [
          { role: "system", content: "Eres un analista de datos experto y asistente de riesgo que devuelve solo formato JSON conforme a las especificaciones dadas." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });

    if (!orResponse.ok) {
      const errorBody = await orResponse.text();
      console.error(`OpenRouter error (${orResponse.status}): ${errorBody}`);
      return new Response(JSON.stringify({ 
        error: `Error del proveedor de IA (${orResponse.status}). Intenta de nuevo en unos segundos.`,
        details: errorBody
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const orData = await orResponse.json();
    const contentText = orData.choices?.[0]?.message?.content;
    
    let validations: any[] = [];

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
    }

    if (validations.length === 0) {
      console.warn('OpenRouter respondió pero sin validaciones válidas');
    } else {
      console.log(`Validación exitosa: ${validations.length} negocios evaluados con OpenRouter (${openrouterModel})`);
    }

    return new Response(JSON.stringify({ validations }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Error validating businesses:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Error inesperado al validar negocios"
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
