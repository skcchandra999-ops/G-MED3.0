import React, { useState, useEffect } from 'react';
import { 
  Users, ClipboardList, CheckCircle, Clock, Volume2, VolumeX, Copy, 
  Sparkles, ShieldAlert, Heart, Activity, FileText, ArrowRight, Star,
  Edit2, Check, AlertTriangle, Play, HelpCircle
} from 'lucide-react';
import { OrthoPatient, PatientPlanItem } from '../types';

interface ExecutiveBriefingCardProps {
  patient: OrthoPatient;
  onNavigate: (tab: any) => void;
  updatePatient: (id: string, updates: Partial<OrthoPatient>) => void;
}

export default function ExecutiveBriefingCard({
  patient,
  onNavigate,
  updatePatient
}: ExecutiveBriefingCardProps) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupport, setSpeechSupport] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Local state for editable fields to ensure seamless real-time updating
  const [editDiagnosis, setEditDiagnosis] = useState(patient.diagnosis || '');
  const [editSP, setEditSP] = useState(patient.history?.psh || '');
  const [editAdmittedFor, setEditAdmittedFor] = useState(patient.surgicalProcedure || '');
  const [editStatus, setEditStatus] = useState(patient.status || 'Pre-operative');
  const [editDNVS, setEditDNVS] = useState(patient.physicalExam?.localExam?.neurovascular || 'Intact');
  const [editAlerts, setEditAlerts] = useState('');
  const [editHospitalDayText, setEditHospitalDayText] = useState('');

  // Sync state with patient updates
  useEffect(() => {
    setEditDiagnosis(patient.diagnosis || '');
    setEditSP(patient.history?.psh || '');
    setEditAdmittedFor(patient.surgicalProcedure || '');
    setEditStatus(patient.status || 'Pre-operative');
    setEditDNVS(patient.physicalExam?.localExam?.neurovascular || 'Intact');
    
    // Resolve alerts text: NPO status combined with Allergies
    const npo = patient.pacNpoStatus || 'NPO';
    const allergy = patient.history?.allergies || 'No Known Drug Allergy';
    setEditAlerts(`${npo} | ${allergy}`);

    // Resolve hospital day text: Day X
    if (patient.demographics?.admissionDate) {
      try {
        const adm = new Date(patient.demographics.admissionDate);
        const diffTime = Math.abs(new Date().getTime() - adm.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setEditHospitalDayText(`Day ${diffDays || 1}`);
      } catch (e) {
        setEditHospitalDayText('Day 1');
      }
    } else {
      setEditHospitalDayText('Day 4'); // Default fallback
    }
  }, [patient]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setSpeechSupport(true);
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Save changes back to the parent EMR patient record
  const saveChanges = () => {
    // Split alerts back into NPO status and Allergies
    const parts = editAlerts.split('|').map(s => s.trim());
    const npoStatus = parts[0] || 'NPO';
    const allergiesText = parts[1] || 'No Known Drug Allergy';

    const historyUpdates = {
      ...(patient.history || {
        chiefComplaint: '',
        hpi: '',
        pmh: '',
        medications: '',
        socialHistory: ''
      }),
      psh: editSP,
      allergies: allergiesText
    };

    const physicalExamUpdates = {
      ...(patient.physicalExam || {
        general: '',
        localExam: {
          inspection: '',
          palpation: '',
          movements: '',
          neurovascular: ''
        }
      }),
      localExam: {
        ...(patient.physicalExam?.localExam || {
          inspection: '',
          palpation: '',
          movements: ''
        }),
        neurovascular: editDNVS
      }
    };

    updatePatient(patient.id, {
      diagnosis: editDiagnosis,
      surgicalProcedure: editAdmittedFor,
      status: editStatus,
      pacNpoStatus: npoStatus,
      history: historyUpdates,
      physicalExam: physicalExamUpdates
    });

    setIsEditing(false);
  };

  // Helper to build pristine plain text copy for rounds
  const generatePlainTextSummary = () => {
    const ageSex = `${patient.demographics.age}Y/${patient.demographics.sex}`;
    const bed = `Bed ${patient.demographics.bedNumber || '---'}`;
    const todaysPlans = patient.plan && patient.plan.length > 0
      ? patient.plan.map(p => `• ${p.text}`).join('\n')
      : '• PAC\n• Consent\n• OT Tomorrow';
    const pendingItems = patient.plan && patient.plan.filter(p => p.status === 'pending').length > 0
      ? patient.plan.filter(p => p.status === 'pending').map(p => `☐ ${p.text}`).join('\n')
      : '☐ Blood\n☐ Implant\n☐ Consent';

    return `PATIENT SUMMARY\n\n` +
           `${ageSex} | ${bed}\n\n` +
           `Diagnosis:\n${editDiagnosis || 'Rt Knee Arthrofibrosis'}\n\n` +
           `S/P:\n${editSP || 'ORIF Proximal Tibia with Bicondylar Plating'}\n\n` +
           `Admitted For:\n${editAdmittedFor || 'Arthrolysis + Implant Removal'}\n\n` +
           `Hospital Day:\n${editHospitalDayText}\n\n` +
           `Current Status:\n${editStatus}\n\n` +
           `Today's Plan:\n${todaysPlans}\n\n` +
           `Pending:\n${pendingItems}\n\n` +
           `Alerts:\n${editAlerts}\n\n` +
           `DNVS:\n${editDNVS}`;
  };

  // TTS audio rounds synthesis
  const handleSpeak = () => {
    if (!speechSupport) return;
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = generatePlainTextSummary()
      .replace(/☐/g, 'Pending')
      .replace(/•/g, 'Plan:')
      .replace(/S\/P/g, 'Status Post')
      .replace(/DNVS/g, 'Distal Neurovascular Status');

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const copyBriefing = async () => {
    const text = generatePlainTextSummary();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy briefing:', err);
    }
  };

  // Toggle checklist status of plan items
  const togglePlanItemStatus = (itemId: string, currentStatus: 'pending' | 'done') => {
    const updatedPlan = patient.plan.map(p => {
      if (p.id === itemId) {
        return { ...p, status: currentStatus === 'pending' ? 'done' as const : 'pending' as const };
      }
      return p;
    });
    updatePatient(patient.id, { plan: updatedPlan });
  };

  // Add default items if patient plan is empty to match user style
  const initializeSamplePlan = () => {
    const samples: PatientPlanItem[] = [
      { id: 'sample-p1', text: 'PAC', status: 'done' },
      { id: 'sample-p2', text: 'Consent', status: 'done' },
      { id: 'sample-p3', text: 'OT Tomorrow', status: 'done' },
      { id: 'sample-p4', text: 'Blood', status: 'pending' },
      { id: 'sample-p5', text: 'Implant', status: 'pending' },
      { id: 'sample-p6', text: 'Consent Verification', status: 'pending' }
    ];
    updatePatient(patient.id, { plan: samples });
  };

  return (
    <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden font-sans max-w-2xl mx-auto transition-all hover:shadow-cyan-950/20">
      
      {/* Visual top border */}
      <div className="h-2 w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600" />

      {/* Header Bar */}
      <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400">
            <Star className="h-5 w-5 fill-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-cyan-400 font-mono">
              PATIENT SUMMARY
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              SII CLINICAL REPORT · UNIT-I
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {speechSupport && (
            <button
              onClick={handleSpeak}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isSpeaking 
                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse' 
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
              title={isSpeaking ? "Stop rounds playback" : "Listen to rounds playback"}
            >
              {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}

          <button
            onClick={copyBriefing}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
            title="Copy patient summary for rounds/WhatsApp"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>

          <button
            onClick={() => {
              if (isEditing) {
                saveChanges();
              } else {
                setIsEditing(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              isEditing 
                ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {isEditing ? (
              <><Check className="h-3.5 w-3.5" /> Save</>
            ) : (
              <><Edit2 className="h-3.5 w-3.5" /> Edit</>
            )}
          </button>
        </div>
      </div>

      {/* Patient demographics strip */}
      <div className="px-6 py-4 bg-slate-950/45 border-b border-slate-850 flex flex-wrap items-center justify-between gap-3 font-mono">
        <span className="text-sm font-black text-slate-300">
          {patient.demographics.age}Y/{patient.demographics.sex}
        </span>
        <span className="text-sm font-black text-cyan-400 uppercase tracking-wider">
          Bed {patient.demographics.bedNumber || '---'}
        </span>
      </div>

      {/* Patient summary body */}
      <div className="p-6 space-y-6">
        
        {isEditing ? (
          /* EDITING FORM VIEWS */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 font-mono">Diagnosis</label>
                <input
                  type="text"
                  value={editDiagnosis}
                  onChange={(e) => setEditDiagnosis(e.target.value)}
                  className="w-full text-xs font-bold text-slate-100 p-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 font-mono">S/P (Status Post)</label>
                <input
                  type="text"
                  value={editSP}
                  onChange={(e) => setEditSP(e.target.value)}
                  className="w-full text-xs font-bold text-slate-100 p-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 font-mono">Admitted For</label>
                <input
                  type="text"
                  value={editAdmittedFor}
                  onChange={(e) => setEditAdmittedFor(e.target.value)}
                  className="w-full text-xs font-bold text-slate-100 p-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 font-mono">Current Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full text-xs font-bold text-slate-100 p-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-cyan-500"
                >
                  <option value="Pre-operative">Pre-operative</option>
                  <option value="Post-operative Day 1">Post-operative Day 1</option>
                  <option value="Post-operative Day 2">Post-operative Day 2</option>
                  <option value="Post-operative Day 3">Post-operative Day 3</option>
                  <option value="Post-operative Day 4">Post-operative Day 4</option>
                  <option value="Conservative Management">Conservative Management</option>
                  <option value="Discharge Planned">Discharge Planned</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 font-mono">Alerts (NPO | Allergies)</label>
                <input
                  type="text"
                  value={editAlerts}
                  onChange={(e) => setEditAlerts(e.target.value)}
                  className="w-full text-xs font-bold text-slate-100 p-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-cyan-500"
                  placeholder="e.g. NPO | No Known Drug Allergy"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 font-mono">DNVS (Neurovascular Status)</label>
                <input
                  type="text"
                  value={editDNVS}
                  onChange={(e) => setEditDNVS(e.target.value)}
                  className="w-full text-xs font-bold text-slate-100 p-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  // Reset states to original patient data
                  setEditDiagnosis(patient.diagnosis || '');
                  setEditSP(patient.history?.psh || '');
                  setEditAdmittedFor(patient.surgicalProcedure || '');
                  setEditStatus(patient.status || 'Pre-operative');
                  setEditDNVS(patient.physicalExam?.localExam?.neurovascular || 'Intact');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveChanges}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-lg cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD CLEAN VIEW IN MEDICAL ROUNDS FORMAT */
          <div className="space-y-5">
            {/* Diagnosis */}
            <div className="border-l-2 border-cyan-500 pl-4 space-y-1">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                Diagnosis
              </h3>
              <p className="text-sm font-black text-slate-100 tracking-tight uppercase">
                {editDiagnosis || 'Rt Knee Arthrofibrosis'}
              </p>
            </div>

            {/* Status Post (S/P) */}
            <div className="border-l-2 border-slate-700 pl-4 space-y-1">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                S/P
              </h3>
              <p className="text-xs font-semibold text-slate-300 leading-normal">
                {editSP || 'ORIF Proximal Tibia with Bicondylar Plating'}
              </p>
            </div>

            {/* Admitted For */}
            <div className="border-l-2 border-indigo-500 pl-4 space-y-1">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                Admitted For
              </h3>
              <p className="text-xs font-bold text-slate-200">
                {editAdmittedFor || 'Arthrolysis + Implant Removal'}
              </p>
            </div>

            {/* Double Row: Hospital Day & Current Status */}
            <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-800/80 py-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400 font-mono block">Hospital Day</span>
                <span className="text-xs font-black text-cyan-400">{editHospitalDayText}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400 font-mono block">Current Status</span>
                <span className="text-xs font-black text-slate-200">{editStatus}</span>
              </div>
            </div>

            {/* Double Column List: Today's Plan & Pending items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
              
              {/* Today's Plan */}
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Today's Plan
                </h3>
                
                {patient.plan && patient.plan.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-300 font-semibold font-mono">
                    {patient.plan.map((item) => (
                      <li key={item.id} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="text-emerald-500">•</span>
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="space-y-2">
                    <ul className="space-y-1.5 text-xs text-slate-300 font-semibold font-mono">
                      <li className="flex items-start gap-1.5"><span className="text-emerald-500">•</span> PAC</li>
                      <li className="flex items-start gap-1.5"><span className="text-emerald-500">•</span> Consent</li>
                      <li className="flex items-start gap-1.5"><span className="text-emerald-500">•</span> OT Tomorrow</li>
                    </ul>
                    <button
                      onClick={initializeSamplePlan}
                      className="text-[9px] font-black text-cyan-400 uppercase tracking-widest hover:underline"
                    >
                      + Load Sample Plan Tasks
                    </button>
                  </div>
                )}
              </div>

              {/* Pending Checklist */}
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending Items
                </h3>

                {patient.plan && patient.plan.filter(p => p.status === 'pending').length > 0 ? (
                  <div className="space-y-1.5 font-mono">
                    {patient.plan.filter(p => p.status === 'pending').map((item) => (
                      <button
                        key={item.id}
                        onClick={() => togglePlanItemStatus(item.id, 'pending')}
                        className="w-full text-left flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer group"
                      >
                        <span className="w-4 h-4 rounded border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-amber-500 text-[10px]">
                          ☐
                        </span>
                        <span>{item.text}</span>
                      </button>
                    ))}
                  </div>
                ) : patient.plan && patient.plan.length > 0 ? (
                  <p className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> All tasks completed! No pending items.
                  </p>
                ) : (
                  <div className="space-y-1.5 font-mono">
                    <button 
                      onClick={initializeSamplePlan} 
                      className="w-full text-left flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-all"
                    >
                      <span>☐ Blood</span>
                    </button>
                    <button 
                      onClick={initializeSamplePlan} 
                      className="w-full text-left flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-all"
                    >
                      <span>☐ Implant</span>
                    </button>
                    <button 
                      onClick={initializeSamplePlan} 
                      className="w-full text-left flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-all"
                    >
                      <span>☐ Consent</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Alerts Strip */}
            <div className="bg-red-950/20 rounded-2xl p-4 border border-red-900/40 flex items-start gap-3 mt-4">
              <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed font-mono">
                <span className="block text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">
                  Alerts
                </span>
                <p className="text-slate-200 font-bold uppercase tracking-wide">
                  {editAlerts || 'NPO | No Known Drug Allergy'}
                </p>
              </div>
            </div>

            {/* DNVS */}
            <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-cyan-400" />
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 font-mono block">
                    DNVS (Distal Neurovascular Status)
                  </span>
                  <span className="text-xs font-black text-slate-200 font-mono uppercase tracking-wide">
                    {editDNVS || 'Intact'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onNavigate('history_exam')}
                className="text-[10px] font-black text-cyan-400 uppercase tracking-wider hover:underline flex items-center gap-1 font-mono"
              >
                Go to Examination <ArrowRight className="h-3 w-3" />
              </button>
            </div>

          </div>
        )}

      </div>
      
      {/* Footer warning */}
      <div className="px-6 py-4.5 bg-slate-950/70 border-t border-slate-850 text-center text-[10px] font-bold text-slate-400 font-mono tracking-wide leading-relaxed">
        ⚠️ AI-generated clinical summary. Must be verified by the Resident/Attending.
      </div>
    </div>
  );
}
