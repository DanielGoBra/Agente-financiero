import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize Gemini client
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
        description: "A score from 1 to 10 indicating how confident we are in the data and that it fits the target profile for financial credits."
      },
      reasoning: {
        type: Type.STRING,
        description: "A brief sentence explaining why it was classified as such."
      }
    },
    required: ["id", "isMicroSME", "reliabilityScore", "reasoning"]
  }
};

app.post("/api/validate-businesses", async (req, res) => {
  try {
    const { businesses } = req.body;
    
    if (!businesses || !Array.isArray(businesses)) {
      return res.status(400).json({ error: "Invalid businesses data" });
    }

    if (businesses.length === 0) {
      return res.json({ validations: [] });
    }

    const prompt = `
Eres un agente de riesgo de crédito financiero. Tengo una lista de negocios extraídos de Google Maps en Antioquia, Colombia.
Tu objetivo es identificar cuáles de ellos son micro, pequeñas o medianas empresas (MIPYMES) o negocios independientes, y descartar grandes corporaciones, franquicias o cadenas nacionales (ej. Éxito, Bancolombia, McDonald's, D1, Ara, etc.).
Queremos ofrecer créditos financieros a estas MIPYMES.

IMPORTANTE: El campo 'reasoning' debe ser redactado en Español de forma muy breve.

Por favor evalúa cada negocio en esta lista JSON y retorna el esquema de validación:
${JSON.stringify(businesses.map((b: any) => ({
  id: b.id,
  name: b.name,
  types: b.types,
  website: b.website,
  rating: b.rating
})), null, 2)}`;

    let response;
    let retries = 3;
    let delay = 2000;
    
    for (let i = 0; i < retries; i++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: businessValidationSchema,
            temperature: 0.2
          }
        });
        break;
      } catch (err: any) {
        if (i === retries - 1) throw err;
        console.warn(`Gemini API error, retrying (${i + 1}/${retries}):`, err.message);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }

    const textOutput = response?.text;
    if (textOutput) {
       const validations = JSON.parse(textOutput);
       res.json({ validations });
    } else {
       res.status(500).json({ error: "No text returned from Gemini" });
    }

  } catch (error: any) {
    console.error("Error validating businesses:", error);
    res.status(500).json({ error: error.message || "Failed to validate businesses" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
