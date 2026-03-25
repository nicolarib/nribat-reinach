import { GoogleGenAI, SchemaType as Type } from "@google/genai";
import { EvaluationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

export const evaluatePodcast = async (
  audioBase64: string,
  mimeType: string,
  metadata: { studentNames: string; region: string }
): Promise<EvaluationResult> => {
  const modelName = 'gemini-1.5-flash';
  const model = ai.getGenerativeModel({ 
    model: modelName,
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

  const prompt = `
    Sei un insegnante esperto di Geografia e lingua Italiana. 
    Analizza questo file per la regione: ${metadata.region}.
    VALUTAZIONE (1-5): Inhalte richtig, Viele Info, Kreativität, Beide sprechen.
    Commento in TEDESCO (usando "ss").
    Errori in ITALIANO categorizzati: Inhalt, Sprache, Aussprache.
    Trascrizione bilingue (IT/DE).
    Restituisci JSON.
  `;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: audioBase64,
      },
    },
    { text: prompt },
  ]);

  const response = await result.response;
  const rawJson = JSON.parse(response.text());
  
  const scores = rawJson.scores as Record<string, number>;
  const totalPoints = Object.values(scores).reduce((a, b) => a + b, 0);
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
