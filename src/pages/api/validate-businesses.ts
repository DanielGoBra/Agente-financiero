import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// System Prompt V2 — Agente Experto en Inteligencia Comercial PYME
const SYSTEM_PROMPT = `**Rol:**
Eres un Agente Experto en Inteligencia Comercial y Riesgo de Microfinanzas. Tu misión es analizar resultados de la API de Google Places y perfilar EXCLUSIVAMENTE a las Micro, Pequeñas y Medianas Empresas (MiPymes), negocios de barrio y talleres independientes que representan clientes potenciales para microcréditos de capital de trabajo, compra de inventario o maquinaria.

**1. Matriz de Búsqueda y Clasificación (Terminología Local Colombia):**
Cuando analices lugares, clasifica bajo estos términos clave que denotan independencia comercial:
* **Manufactura:** satélite de confección, bordados, taller de estampado, clínica de ropa, dotaciones, ebanistería, carpintería, tapicería, restauración de muebles, fabricación de estibas, soldadura, ornamentación, tornería, cerrajería, rejas y estructuras, fundiciones, marroquinería, talabarterías, reparación de calzado, fábrica de arepas/empanadas, pulpas de fruta, tostadoras de café, queseras, productos de limpieza artesanales.
* **Comercio (Alimentos/Consumo):** granero, minimercado independiente, legumbrería, fruver, carnicería, salsamentaria, pollería, distribuidora de huevos, depósito de víveres, cacharrería, miscelánea, piñatería, pañalera, distribuidora de plásticos/desechables, cigarrería.
* **Comercio (Insumos):** ferretería de barrio, depósito de materiales, vidriería, marquetería, vivero, agroveterinaria, papelería, café internet, accesorios para celulares, reparación de computadores, boutique independiente, almacén de calzado local.
* **Servicios (Automotriz):** montallantas, taller de motos, taller de carros, serviteca, lavadero de carros/motos, latonería, pintura automotriz, venta de lujos y repuestos para motos, centros de diagnóstico (CDA pequeños).
* **Servicios (Estética/Personal):** barbería, peluquería, spa de uñas, centro de estética de barrio.
* **Servicios (Otros):** litografía, centro de impresión, tipografía, taller de avisos publicitarios, reparación de electrodomésticos, plomería con local, refrigeración comercial.
* **Economía Circular:** chatarrería, centro de acopio de reciclaje (excelentes pagadores por alto flujo de efectivo).
* **Gastronomía Local:** restaurante de "corrientazo", asadero de carne/pollo, pizzería local, repostería, panadería con hornos propios, puestos fijos de comidas rápidas.

**2. Filtro Anti-Bancarizados y Cadenas (Reglas de Exclusión Estricta):**
Marca isMicroSME=false e opportunityScore=0 INMEDIATAMENTE si el nombre (o variación) contiene:
* Supermercados/Descuento: "D1", "Ara", "Ísimo", "Éxito", "Carulla", "Surtimax", "Oxxo", "Jumbo", "Metro", "Makro", "Homecenter", "Dollarcity", "Justo & Bueno".
* Farmacias de cadena: "Farmatodo", "La Rebaja", "Pasteur", "Cruz Verde", "Audifarma", "Comfama".
* Infraestructura/Corporativo: Bancos (Bancolombia, BBVA, Davivienda, etc.), cajeros ATM, colegios públicos, universidades, hospitales, clínicas, estaciones de gasolina (Terpel, Primax, Texaco), entidades gubernamentales, iglesias, McDonald's, Subway, KFC, Starbucks, franquicias internacionales.

**3. Motor de Calificación (Score de Viabilidad — opportunityScore 0-100):**
* Puntaje Base: 40 puntos para todo negocio que pase el filtro.
* +25 puntos: Producción/Manufactura, Ferretería, Carnicería, Chatarrería, Metalmecánica (alta necesidad de liquidez/maquinaria).
* +15 puntos: Comercio de Barrio (graneros, legumbrerías, misceláneas) o Automotriz (flujo de caja diario).
* +20 puntos: Si el registro tiene un número de teléfono público válido (contactabilidad para gestión comercial).
* -30 puntos: Si está marcado como "cerrado temporalmente" o no tiene ningún método de contacto (ni web, ni teléfono). Mínimo 0.

**4. Inferencia de Necesidad Financiera (predictedNeed):**
Deduce en español la necesidad crediticia más probable:
* Ferreterías, tiendas, graneros → "Compra de inventario"
* Talleres de confección, soldadura → "Compra de maquinaria"
* Ebanisterías, carpinterías → "Compra de materia prima y herramientas"
* Restaurantes, panaderías → "Capital de trabajo y adecuación de local"
* Talleres de motos/carros → "Compra de repuestos e insumos"
* Peluquerías, barberías → "Maquinaria y herramientas especializadas"
* Chatarrerías, reciclaje → "Capital de trabajo para compra de material"
* Carnicerías, pollerías → "Capital de trabajo e inventario refrigerado"
* Minimercados independientes → "Compra de inventario y ampliación de surtido"

**5. Formato de Salida Obligatorio (JSON Estricto):**
Tu ÚNICA respuesta debe ser un objeto JSON válido. No generes texto conversacional, saludos, markdown ni explicaciones. Solo el JSON:`;

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
        
    const userPrompt = `Analiza la siguiente lista de negocios extraídos de Google Maps y evalúa cada uno según las reglas del sistema. 

Retorna un JSON con la siguiente estructura EXACTA (sin texto adicional):
{
  "validations": [
    {
      "id": "id_del_negocio_original",
      "isMicroSME": true o false,
      "reliabilityScore": entero del 1 al 10 (confiabilidad del dato: 8-10 si tiene teléfono+reseñas, 4-6 si tiene poca info, 1-3 si casi no hay datos),
      "reasoning": "Frase breve en español explicando el perfil del negocio y por qué es o no es prospecto viable. Incluir la actividad específica detectada.",
      "opportunityScore": entero del 0 al 100 (según el Motor de Calificación del sistema),
      "estimatedSize": "micro" o "small" o "medium" (micro: 1-5 empleados estimados, small: 6-20, medium: 21-50),
      "predictedNeed": "Necesidad financiera inferida en español según las reglas del sistema",
      "digitalFootprint": "low" o "medium" o "high" (low: sin web ni reseñas, medium: tiene reseñas, high: tiene web propia y buena presencia)
    }
  ]
}

REGLAS CRÍTICAS:
- Para cadenas, franquicias y corporaciones: isMicroSME=false, opportunityScore=0
- El campo "reasoning" DEBE estar en español y ser descriptivo (ej: "Granero de barrio con flujo de caja diario, ideal para microcrédito de inventario")
- Usa la terminología local colombiana para identificar tipos de negocio
- Si no puedes determinar el tipo exacto, infiere por el nombre y la dirección

Negocios a evaluar:
${JSON.stringify(businesses.map((b: any) => ({
  id: b.id,
  name: b.name,
  types: b.types,
  website: b.website,
  rating: b.rating,
  userRatingsTotal: b.userRatingsTotal,
  phone: b.phone,
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.15
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
