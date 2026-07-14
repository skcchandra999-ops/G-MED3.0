import React, { useState } from 'react';
import { analyzeDrugInteractions } from '../services/geminiService';
import { DrugInteractionResult } from '../types';
import { Plus, Trash2, AlertTriangle, CheckCircle, AlertOctagon, Info, Loader2 } from 'lucide-react';

interface DrugEntry {
  id: string;
  name: string;
  dosage: string;
}

const DrugInteractionChecker: React.FC = () => {
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [drugs, setDrugs] = useState<DrugEntry[]>([]);
  const [result, setResult] = useState<DrugInteractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddDrug = () => {
    if (drugName.trim()) {
      // Prevent adding exact duplicates (same name)
      if (drugs.some(d => d.name.toLowerCase() === drugName.trim().toLowerCase())) {
        setError(`"${drugName}" is already in the list.`);
        setTimeout(() => setError(null), 3000);
        return;
      }

      const newDrug: DrugEntry = {
        id: Date.now().toString(),
        name: drugName.trim(),
        dosage: dosage.trim()
      };

      setDrugs([...drugs, newDrug]);
      setDrugName('');
      setDosage('');
      setResult(null); // Reset results when list changes
    }
  };

  const handleRemoveDrug = (id: string) => {
    setDrugs(drugs.filter(d => d.id !== id));
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (drugs.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      // Pass the whole objects to the service
      const analysis = await analyzeDrugInteractions(drugs);
      setResult(analysis);
    } catch (e) {
      setError("Failed to analyze interactions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'major': return 'bg-red-50 dark:bg-red-955/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/40';
      case 'moderate': return 'bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40';
      case 'minor': return 'bg-yellow-50 dark:bg-yellow-955/20 text-yellow-700 dark:text-yellow-300 border-yellow-250 dark:border-yellow-905/40';
      default: return 'bg-green-50 dark:bg-green-955/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-950/40';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'major': return <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'moderate': return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case 'minor': return <Info className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      default: return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-205 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-sans">Drug Interaction Checker</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Enter two or more drugs (and optional dosages) to screen for potential interactions through Gemini Clinical AI.</p>
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={drugName}
                onChange={(e) => setDrugName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDrug()}
                placeholder="Drug name (e.g., Warfarin)"
                className="w-full p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-[#0077b6] outline-none text-sm font-medium"
              />
            </div>
            <div className="flex-1 md:max-w-[200px]">
               <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDrug()}
                placeholder="Dosage (e.g., 5mg daily)"
                className="w-full p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-[#0077b6] outline-none text-sm font-medium"
              />
            </div>
            <button
              onClick={handleAddDrug}
              className="bg-[#0077b6] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#005f92] transition-colors flex items-center justify-center text-sm uppercase tracking-wider shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[50px] items-center">
            {drugs.length === 0 && (
              <span className="text-slate-400 dark:text-slate-550 italic text-xs py-2">No drugs added yet.</span>
            )}
            {drugs.map((drug) => (
              <div key={drug.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-3 py-1.5 rounded-full flex items-center text-slate-705 dark:text-slate-300 shadow-sm text-xs">
                <div className="flex flex-row items-baseline mr-2 gap-1.5">
                    <span className="font-extrabold">{drug.name}</span>
                    {drug.dosage && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium font-mono">({drug.dosage})</span>
                    )}
                </div>
                <button onClick={() => handleRemoveDrug(drug.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
             <button
              onClick={handleAnalyze}
              disabled={drugs.length < 2 || loading}
              className={`
                px-8 py-2.5 rounded-lg font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center
                ${drugs.length < 2 
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-402 dark:text-slate-650 cursor-not-allowed' 
                  : 'bg-[#0077b6] text-white hover:bg-[#005f92] shadow-blue-100 dark:shadow-none'}
              `}
            >
              {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Check Interactions
            </button>
          </div>
        </div>

        {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border-l-4 border-red-500 mx-6 mt-6 text-sm font-bold">
                {error}
            </div>
        )}

        {result && (
          <div className="p-6">
            <div className="mb-8">
              <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Clinical Analysis Summary</h3>
              <div className="bg-slate-50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium shadow-inner">
                {result.summary}
              </div>
            </div>

            <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Detailed Interactions ({result.interactions.length})</h3>
            
            <div className="space-y-4">
              {result.interactions.length === 0 ? (
                 <div className="text-center py-8 text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <CheckCircle className="h-12 w-12 text-green-500 dark:text-green-400 mx-auto mb-3" />
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No known drug interactions detected.</p>
                    <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">These medications do not have significant clinical warnings recorded.</p>
                 </div>
              ) : (
                  result.interactions.map((interaction, idx) => (
                    <div key={idx} className={`p-5 rounded-xl border ${getSeverityColor(interaction.severity)} shadow-sm`}>
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5 mr-4">
                          {getSeverityIcon(interaction.severity)}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                             <h4 className="font-black text-sm tracking-tight text-slate-900 dark:text-white">{interaction.pair.join(' + ')}</h4>
                             <span className="uppercase text-[9px] font-black tracking-widest px-2.5 py-1 bg-white/70 dark:bg-slate-900/60 rounded-full border border-current w-fit">
                                {interaction.severity}
                             </span>
                          </div>
                          
                          <p className="mb-3 text-xs font-bold leading-normal">{interaction.description}</p>
                          
                          {interaction.mechanism && (
                            <div className="mb-2 text-xs opacity-90 leading-normal">
                              <span className="font-extrabold mr-1">Mechanism:</span> {interaction.mechanism}
                            </div>
                          )}
                          
                          {interaction.management && (
                             <div className="text-xs opacity-90 leading-normal">
                               <span className="font-extrabold mr-1">Management:</span> {interaction.management}
                             </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrugInteractionChecker;