
import { GoogleGenAI, Type } from "@google/genai";
import { EvaluationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const evaluatePodcast = async (
  audioBase64: string,
  mimeType: string,
  metadata: { studentNames: string; region: string }
): Promise<EvaluationResult> => {
  const model = 'gemini-3-flash-preview';

  const prompt = `
    Sei un insegnante esperto di Geografia e lingua Italiana. 
    Analizza questo file (audio podcast o video) registrato da studenti sulla regione italiana: ${metadata.region}.
    Il contenuto è recitato principalmente in lingua ITALIANA.
    
    VALUTAZIONE (1-5):
    1. Inhalte sind richtig: Correttezza dei fatti geografici.
    2. Viele Informationen: Approfondimento del contenuto.
    3. Kreativität: Originalità e stile (audio o video).
    4. Beide sprechen mit: Equilibrio nella partecipazione.

    REGOLE PER IL GIUDIZIO (comment):
    - Scrivi in lingua TEDESCA (usando sempre "ss" al posto di "ß").
    - Fornisci una VALUTAZIONE SINTETICA e concisa (massimo 15-20 parole).

    ANALISI DEGLI ERRORI (detailedErrors):
    - Riporta SOLO i principali errori di sintassi e di grammatica e gli errori di pronuncia più evidenti commessi in lingua ITALIANA.
    - Includi anche eventuali errori gravi di contenuto geografico su ${metadata.region}.
    - Ignora errori linguistici minori o poco rilevanti.
    - NON correggere e NON segnalare eventuali errori nella lingua TEDESCA.
    - Categorizza gli errori in:
      - "Inhalt": Errori rilevanti sui dati geografici.
      - "Sprache": Principali errori di grammatica o sintassi in ITALIANO.
      - "Aussprache": Errori di pronuncia più evidenti di parole ITALIANE.
    
    Per ogni errore fornisci:
    - original: La frase errata detta dagli studenti (in italiano).
    - correction: La forma corretta (in italiano).
    - explanation: Breve nota in TEDESCO (usando "ss") che spiega l'errore.

    TRASCRIZIONE:
    - Testo parlato (ITALIANO) e traduzione a fronte (TEDESCO con "ss").

    Restituisci i risultati in formato JSON.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        { text: prompt },
      ],
    },
    config: {
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
                category: { type: Type.STRING, enum: ["Inhalt", "Sprache", "Aussprache"] },
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
    },
  });

  const rawJson = JSON.parse(response.text);
  
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
