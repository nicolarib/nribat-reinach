
import React, { useState, useRef } from 'react';
import { 
  Mic, 
  Upload, 
  FileAudio, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  RefreshCw,
  Info,
  Star,
  FileText,
  MessageSquare,
  Ear,
  MapPin,
  Languages
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { evaluatePodcast } from './services/geminiService';
import { EvaluationResult, ProcessingStep } from './types';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [studentNames, setStudentNames] = useState('');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { label: 'Caricamento audio...', status: 'pending' },
    { label: 'Analisi errori in Italiano...', status: 'pending' },
    { label: 'Valutazione criteri...', status: 'pending' },
    { label: 'Sintesi giudizio...', status: 'pending' },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const updateStep = (index: number, status: ProcessingStep['status']) => {
    setSteps(prev => prev.map((step, i) => i === index ? { ...step, status } : step));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleEvaluate = async () => {
    if (!file || !studentNames || !region) {
      setError('Inserisci tutti i campi obbligatori.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));

    try {
      updateStep(0, 'loading');
      const base64 = await fileToBase64(file);
      updateStep(0, 'completed');

      updateStep(1, 'loading');
      updateStep(2, 'loading');
      const evaluation = await evaluatePodcast(base64, file.type, {
        studentNames,
        region,
      });
      updateStep(1, 'completed');
      updateStep(2, 'completed');
      updateStep(3, 'completed');

      setResult(evaluation);
    } catch (err: any) {
      setError('Errore durante la valutazione: ' + (err.message || 'Errore sconosciuto'));
      setSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
    } finally {
      setLoading(false);
    }
  };

  const downloadTranscript = () => {
    if (!result || !result.transcript) return;
    let content = `TRASCRIZIONE PODCAST - ${result.region}\n\n`;
    result.transcript.forEach((line) => {
      content += `[IT]: ${line.italian}\n[DE]: ${line.german}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Trascrizione_${result.region}.txt`;
    link.click();
  };

  const downloadPDF = () => {
    if (!result) return;
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.setTextColor(37, 99, 235);
      doc.text('Scheda Valutazione Podcast', 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Regione: ${result.region} | Studenti: ${result.studentNames}`, 14, 30);

      autoTable(doc, {
        startY: 40,
        head: [['Criterio', 'Punteggio']],
        body: [
          ['Inhalte sind richtig', `${result.scores.contentAccuracy}/5`],
          ['Viele Informationen', `${result.scores.informationRichness}/5`],
          ['Kreativität', `${result.scores.creativity}/5`],
          ['Beide sprechen mit', `${result.scores.balancedParticipation}/5`],
          [{ content: 'VOTO FINALE', styles: { fontStyle: 'bold' } }, { content: `${result.finalGrade.toFixed(1)}`, styles: { fontStyle: 'bold' } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] },
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('Errori in Italiano / Contenuto:', 14, currentY);
      
      const errorBody = result.detailedErrors.map(e => [e.category, e.original, e.correction, e.explanation]);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Tipo', 'Errore (IT)', 'Correzione (IT)', 'Nota (DE)']],
        body: errorBody,
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38] },
      });

      doc.save(`Valutazione_${result.region}.pdf`);
    } catch (e) { console.error(e); }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mic className="text-blue-600 w-6 h-6" />
            <h1 className="text-xl font-bold text-slate-900">Podcast Evaluator</h1>
          </div>
          <button onClick={reset} className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8">
        {!result ? (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <input type="text" value={studentNames} onChange={(e) => setStudentNames(e.target.value)} placeholder="Nomi Studenti" className="px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Regione" className="px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            <div 
              className={`bg-white rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer hover:border-blue-400 ${file ? 'border-blue-400 bg-blue-50/20' : 'border-slate-200'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden" />
              <Upload className={`mx-auto w-12 h-12 mb-4 ${file ? 'text-blue-600' : 'text-slate-300'}`} />
              <p className="font-semibold text-slate-800">{file ? file.name : 'Carica il Podcast'}</p>
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

            <button onClick={handleEvaluate} disabled={loading || !file} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg ${loading ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {loading ? 'Analisi in corso...' : 'Valuta Podcast'}
            </button>

            {loading && (
              <div className="space-y-2 bg-white p-4 rounded-xl border">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {step.status === 'completed' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border" />}
                    <span className={step.status === 'loading' ? 'text-blue-600 font-bold' : 'text-slate-500'}>{step.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
              <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold">{result.region}</h2>
                  <p className="opacity-80">{result.studentNames}</p>
                </div>
                <div className="bg-amber-400 text-amber-950 px-6 py-4 rounded-2xl text-center shadow-lg">
                  <span className="text-[10px] font-bold block uppercase tracking-widest">Voto</span>
                  <p className="text-4xl font-black">{result.finalGrade.toFixed(1)}</p>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Punteggi</h3>
                    <ScoreRow label="Contenuto" score={result.scores.contentAccuracy} />
                    <ScoreRow label="Ricchezza" score={result.scores.informationRichness} />
                    <ScoreRow label="Creatività" score={result.scores.creativity} />
                    <ScoreRow label="Partecipazione" score={result.scores.balancedParticipation} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">Giudizio Sintetico</h3>
                    <div className="bg-slate-50 p-6 rounded-2xl border italic text-slate-700">
                      "{result.comment}"
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Analisi Errori (Solo Italiano/Contenuto)</h3>
                  {result.detailedErrors.length > 0 ? (
                    <div className="space-y-3">
                      {result.detailedErrors.map((err, i) => (
                        <div key={i} className="p-4 border rounded-2xl flex gap-4 hover:bg-red-50/30 transition-colors">
                          <div className="p-2 bg-red-100 text-red-600 rounded-lg h-fit">
                            {err.category === 'Inhalt' ? <MapPin className="w-5 h-5" /> : err.category === 'Aussprache' ? <Ear className="w-5 h-5" /> : <Languages className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-400 mb-1">{err.category}</p>
                            <p className="text-sm">Errore: <span className="text-red-600 font-bold">"{err.original}"</span></p>
                            <p className="text-sm font-bold">Correzione: <span className="text-green-600">"{err.correction}"</span></p>
                            <p className="text-xs text-slate-500 mt-1 italic">Spiegazione: {err.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Nessun errore rilevato in italiano.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4">
                  <button onClick={downloadPDF} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all">
                    <Download className="w-4 h-4" /> PDF Report
                  </button>
                  <button onClick={downloadTranscript} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all">
                    <FileText className="w-4 h-4" /> Trascrizione
                  </button>
                  <button onClick={reset} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all">
                    Nuova Analisi
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const ScoreRow: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-slate-600 font-medium">{label}</span>
    <span className="font-bold text-blue-600">{score}/5</span>
  </div>
);

export default App;
