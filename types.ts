
export interface DetailedError {
  category: 'Inhalt' | 'Sprache' | 'Aussprache';
  original: string;
  correction: string;
  explanation: string;
}

export interface EvaluationResult {
  studentNames: string;
  region: string;
  date: string;
  scores: {
    contentAccuracy: number; // Inhalte sind richtig
    informationRichness: number; // Viele Informationen
    creativity: number; // Kreativität
    balancedParticipation: number; // Beide sprechen mit
  };
  totalPoints: number;
  finalGrade: number; 
  comment: string;
  detailedErrors: DetailedError[];
  transcript: {
    german: string;
    italian: string;
  }[];
}

export interface ProcessingStep {
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}
