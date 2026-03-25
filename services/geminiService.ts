
import { GoogleGenAI, SchemaType as Type } from "@google/genai";
import { EvaluationResult } from "../types";

// 1. USA VITE_ PER LA CHIAVE (Deve esserci su Netlify con questo nome)
const ai = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export const evaluatePodcast = async (
  audioBase64: string,
  mimeType: string,
  metadata: { studentNames: string; region: string }
): Promise<EvaluationResult> => {
  
  // 2. USA IL MODELLO 1.5-FLASH (Stabile e veloce)
  const genModel = ai.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scores: {
            type: Type.OBJECT,
            properties: {
              contentAccuracy: { type: Type.NUMBER },
              informationRichness: { type: Type.NUMBER },
              creativity: { type: Type.NUMBER },
              balancedParticipation: { type: Type.NUMBER },
            },
            required: ["contentAccuracy", "informationRichness", "creativity", "balancedParticipation"],
          },
          comment: { type: Type.STRING },
          detailedErrors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                original: { type: Type.STRING },
                correction: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["category", "original", "correction", "explanation"]
            }
          },
          transcript: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                german: { type: Type.STRING },
                italian: { type: Type.STRING }
              },
              required: ["german", "italian"]
            }
          }
        },
        required: ["scores", "comment", "detailedErrors", "transcript"],
      },
    }
  });

  const prompt = `Sei un insegnante esperto. Analizza il podcast sulla regione ${metadata.region}. 
  Valuta da 1 a 5 i criteri richiesti. Scrivi il commento in tedesco (usa sempre "ss"). 
  Trascrivi il parlato in italiano con traduzione a fronte in tedesco.`;

  const result = await genModel.generateContent([
    { inlineData: { mimeType, data: audioBase64 } },
    { text: prompt },
  ]);

  const response = await result.response;
  const rawJson = JSON.parse(response.text());

  // Calcolo del voto finale basato sui punteggi (max 20 punti -> voto da 1 a 6)
  const scores = rawJson.scores;
  const totalPoints = Object.values(scores).reduce((a: any, b: any) => a + b, 0);
  const finalGrade = (totalPoints / 20) * 5 + 1;

  return {
    studentNames: metadata.studentNames,
    region: metadata.region,
    date: new Date().toLocaleDateString('it-IT'),
    scores: rawJson.scores,
    totalPoints,
    finalGrade: parseFloat(finalGrade.toFixed(1)),
    comment: rawJson.comment,
    detailedErrors: rawJson.detailedErrors || [],
    transcript: rawJson.transcript || []
  };
};
