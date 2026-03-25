
import { GoogleGenAI, SchemaType as Type } from "@google/genai";
import { EvaluationResult } from "../types";

// Usiamo VITE_ per permettere a Netlify di passare la chiave al browser
const ai = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export const evaluatePodcast = async (
  audioBase64: string,
  mimeType: string,
  metadata: { studentNames: string; region: string }
): Promise<EvaluationResult> => {
  
  // Usiamo il modello 1.5-flash che è quello più stabile e veloce
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

  const prompt = `Analizza il podcast per la regione ${metadata.region}. Valuta 1-5, commento in tedesco (usando ss), trascrizione IT/DE.`;

  const result = await genModel.generateContent([
    { inlineData: { mimeType, data: audioBase64 } },
    { text: prompt },
  ]);

  const response = await result.response;
  const rawJson = JSON.parse(response.text());

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
