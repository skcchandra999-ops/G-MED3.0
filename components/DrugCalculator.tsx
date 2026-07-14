
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, ChevronRight, Pill, ArrowLeft, Play, 
    Users, AlertOctagon, Lock, ClipboardList, 
    AlertCircle, Stethoscope, Activity, HeartPulse, ShieldCheck, CheckCircle2, FlaskConical, Syringe, Layers, Beaker, Clock, ShieldAlert, Lightbulb, MapPin, Info,
    // Fix: Added missing AlertTriangle import
    AlertTriangle
} from 'lucide-react';
import { DRUGS, runCalculation, CalculatorState, calculatePatientMetrics, validatePhysiology, validateTherapeuticDose, ValidationResponse } from '../services/drugEngineAdapter';
import { DrugFormDefinition, Route } from '../types';

type Step = 'admission' | 'selection' | 'form' | 'strength' | 'preparation' | 'dosing' | 'results';

const DrugCalculator: React.FC = () => {
    const [step, setStep] = useState<Step>('admission');
    const [calcResult, setCalcResult] = useState<any>(null);
    const [state, setState] = useState<CalculatorState>({
        patient: { ipNo: '', age: '', gender: 'male', weight: '', height: '', bmi: 0, bsa: 0, ibw: 0 },
        renalImpairment: false, drugId: '', route: 'PO', form: 'tablet', selectedFormDef: null,
        strength: '', calcType: 'antibiotic', indicationIdx: 0, isAdultMode: false, 
        dose: '', doseUnit: 'mg/kg', basis: 'weight', frequency: 'TDS',
        diluentVolume: '5', finalConcentration: 0
    });

    const physAudit = useMemo(() => {
        const w = parseFloat(state.patient.weight);
        const h = parseFloat(state.patient.height);
        const metrics = calculatePatientMetrics(isNaN(w) ? 0 : w, isNaN(h) ? 0 : h, state.patient.gender);
        return validatePhysiology({ ...state.patient, ...metrics });
    }, [state.patient]);

    const doseAudit = useMemo(() => validateTherapeuticDose(state), [state]);

    // Handle preparation calculations
    useEffect(() => {
        if (state.selectedFormDef?.requiresPreparation && state.strength) {
            let newConc = 0;
            if (state.form === 'suspension') {
                const match = state.strength.match(/(\d+)mg\/(\d+)mL/);
                if (match) newConc = parseFloat(match[1]) / parseFloat(match[2]);
            } else {
                const match = state.strength.match(/(\d+)mg/);
                const strValue = match ? parseFloat(match[1]) : 0;
                const totalVol = parseFloat(state.diluentVolume) || 1;
                newConc = strValue / totalVol;
            }
            if (Math.abs(state.finalConcentration - newConc) > 0.001) {
                setState(prev => ({ ...prev, finalConcentration: newConc }));
            }
        }
    }, [state.strength, state.diluentVolume, state.selectedFormDef, state.form, state.finalConcentration]);

    const handleSelectDrug = (drugId: string) => {
        const age = parseFloat(state.patient.age) || 0;
        const weight = parseFloat(state.patient.weight) || 0;
        const isAdult = age >= 18 || weight >= 40;
        setState(prev => ({ ...prev, drugId, isAdultMode: isAdult, doseUnit: isAdult ? 'mg' : 'mg/kg' }));
        setStep('form');
    };

    const handleFormSelect = (formDef: DrugFormDefinition) => {
        setState(prev => ({ 
            ...prev, 
            selectedFormDef: formDef, 
            form: formDef.type, 
            route: formDef.allowedRoutes[0],
            strength: '', // Clear previous
        }));
        setStep('strength');
    };

    const handleStrengthSelect = (str: string) => {
        setState(prev => ({ ...prev, strength: str }));
        if (state.selectedFormDef?.requiresPreparation) {
            setStep('preparation');
        } else {
            setStep('dosing');
        }
    };

    const admissionValid = ['NORMAL', 'ATYPICAL', 'CRITICAL'].includes(physAudit.status) && state.patient.age && state.patient.weight && parseFloat(state.patient.weight) > 0;

    return (
        <div className="pb-24 animate-fade-in max-w-xl mx-auto px-4 overflow-x-hidden">
            
            {/* STEP 1: ADMISSION */}
            {step === 'admission' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center space-x-4 mb-8">
                            <div className="bg-[#0077b6] p-3 rounded-2xl shadow-lg flex items-center justify-center"><Users className="h-6 w-6 text-white" /></div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Admission Audit</h2>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6] dark:text-[#0ea5e9]">Professional Precision Gatekeeper</p>
                            </div>
                        </div>

                        <div className={`mb-8 p-5 rounded-2xl border-2 flex items-center space-x-4 transition-all 
                            ${physAudit.status === 'IMPOSSIBLE' ? 'bg-red-50 border-red-500 text-red-900' : 
                              physAudit.status === 'CRITICAL' ? 'bg-red-50 border-red-300 text-red-700' :
                              physAudit.status === 'ATYPICAL' ? 'bg-amber-50 border-amber-500 text-amber-900' :
                              admissionValid ? 'bg-blue-50 border-[#0077b6] text-[#0077b6]' : 'bg-slate-50 text-slate-400'}`}>
                            {physAudit.status === 'IMPOSSIBLE' ? <AlertOctagon className="h-6 w-6" /> : (physAudit.status === 'CRITICAL' || physAudit.status === 'ATYPICAL') ? <ShieldAlert className="h-6 w-6" /> : <Activity className="h-6 w-6" />}
                            <div>
                                <div className="font-black text-[10px] uppercase tracking-widest">{physAudit.stageLabel} AUDIT</div>
                                <p className="font-bold text-sm leading-tight">{physAudit.message || (admissionValid ? 'Patient biometrics verified.' : 'Enter age & weight to proceed.')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-10">
                            <InputWell label="Age (Yrs)" value={state.patient.age} onChange={v => setState({...state, patient: {...state.patient, age: v}})} />
                            <InputWell label="Weight (kg)" value={state.patient.weight} onChange={v => setState({...state, patient: {...state.patient, weight: v}})} isError={physAudit.status === 'IMPOSSIBLE'} />
                            <InputWell label="Height (cm)" value={state.patient.height} onChange={v => setState({...state, patient: {...state.patient, height: v}})} />
                            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-[24px] border-2 border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                                <label className="text-[9px] font-black uppercase text-slate-400 mb-2">Gender</label>
                                <select value={state.patient.gender} onChange={e => setState({...state, patient: {...state.patient, gender: e.target.value as any}})} className="bg-transparent font-black text-lg text-[#0077b6] outline-none">
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                        </div>

                        <button disabled={!admissionValid} onClick={() => setStep('selection')} className={`w-full h-16 rounded-[32px] font-black text-lg flex items-center justify-center space-x-3 transition-all ${admissionValid ? 'bg-[#0077b6] text-white active:scale-95 shadow-xl' : 'bg-slate-100 text-slate-300'}`}>
                            {admissionValid ? <Play className="h-5 w-5 fill-current" /> : <Lock className="h-5 w-5" />}
                            <span>CHOOSE MEDICATION</span>
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2: DRUG SELECTION */}
            {step === 'selection' && (
                <div className="space-y-6">
                    <button onClick={() => setStep('admission')} className="flex items-center text-[#0077b6] font-bold text-sm bg-white px-6 py-3 rounded-full shadow-md"><ArrowLeft className="h-4 w-4 mr-2" /> Admission Info</button>
                    <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl border border-slate-100 dark:border-slate-800">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6">Select Molecule</h2>
                        <div className="space-y-4">
                            {DRUGS.map(drug => (
                                <button key={drug.id} onClick={() => handleSelectDrug(drug.id)} className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-transparent hover:border-[#0077b6] flex items-center justify-between group transition-all">
                                    <div className="flex items-center space-x-4">
                                        <div className="bg-blue-100 p-3 rounded-2xl"><Pill className="h-6 w-6 text-[#0077b6]" /></div>
                                        <div className="text-left">
                                            <div className="font-black text-lg text-slate-800 dark:text-white">{drug.label}</div>
                                            <div className="text-[10px] font-bold text-[#0077b6] uppercase tracking-widest">{drug.group}</div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-[#0077b6]" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: FORM SELECTION */}
            {step === 'form' && (
                <div className="space-y-6 animate-fade-in">
                    <button onClick={() => setStep('selection')} className="flex items-center text-[#0077b6] font-bold text-sm bg-white px-6 py-3 rounded-full shadow-md"><ArrowLeft className="h-4 w-4 mr-2" /> Back</button>
                    <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl border border-slate-100">
                        <h2 className="text-xl font-black text-slate-900 mb-6">Available Formulations</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {DRUGS.find(d => d.id === state.drugId)?.forms.map((f, i) => (
                                <button key={i} onClick={() => handleFormSelect(f)} className="p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-[#0077b6] flex flex-col items-center space-y-4 transition-all">
                                    {f.type === 'vial' ? <FlaskConical className="h-10 w-10 text-[#0077b6]" /> : f.type === 'suspension' ? <Beaker className="h-10 w-10 text-[#0077b6]" /> : <Layers className="h-10 w-10 text-[#0077b6]" />}
                                    <div className="text-center">
                                        <div className="font-black text-xs uppercase tracking-widest">{f.type}</div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-1">{f.allowedRoutes.join(', ')}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 4: STRENGTH SELECTION */}
            {step === 'strength' && (
                <div className="space-y-6 animate-fade-in">
                    <button onClick={() => setStep('form')} className="flex items-center text-[#0077b6] font-bold text-sm bg-white px-6 py-3 rounded-full shadow-md"><ArrowLeft className="h-4 w-4 mr-2" /> Back</button>
                    <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl border border-slate-100">
                        <h2 className="text-xl font-black text-slate-900 mb-4">Select Source Strength</h2>
                        <p className="text-xs text-slate-500 mb-6 font-bold uppercase tracking-widest">Which {state.form} are you using?</p>
                        <div className="space-y-3">
                            {state.selectedFormDef?.strengths.map((str, i) => (
                                <button key={i} onClick={() => handleStrengthSelect(str)} className="w-full p-6 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-[#0077b6] flex items-center justify-between font-black text-lg text-slate-800 transition-all">
                                    <span>{str}</span>
                                    <ChevronRight className="h-5 w-5 text-[#0077b6]" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 5: PREPARATION */}
            {step === 'preparation' && (
                <div className="space-y-6 animate-fade-in">
                    <button onClick={() => setStep('strength')} className="flex items-center text-[#0077b6] font-bold text-sm bg-white px-6 py-3 rounded-full shadow-md"><ArrowLeft className="h-4 w-4 mr-2" /> Back</button>
                    <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl border border-slate-100">
                        <h2 className="text-xl font-black text-slate-900 mb-6">Preparation Protocol</h2>
                        <div className="space-y-6">
                            <div className="p-6 bg-blue-50 border border-blue-200 rounded-3xl flex items-center space-x-4">
                                <Info className="h-8 w-8 text-[#0077b6]" />
                                <div className="text-sm font-bold text-slate-800">
                                    {state.form === 'vial' ? 'Standard reconstitution is required for intravenous delivery.' : 'Suspension volume for dry syrup reconstitution.'}
                                </div>
                            </div>
                            <InputWell label={state.form === 'vial' ? 'Diluent Volume (mL)' : 'Final Volume (mL)'} value={state.diluentVolume} onChange={v => setState({...state, diluentVolume: v})} />
                            <div className="p-6 bg-slate-50 rounded-3xl text-center">
                                <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Concentration of Prepared {state.form}</div>
                                <div className="text-4xl font-black text-[#0077b6] tracking-tighter">{state.finalConcentration.toFixed(2)} mg/mL</div>
                            </div>
                            <button onClick={() => setStep('dosing')} className="w-full h-16 bg-[#0077b6] text-white rounded-[32px] font-black text-lg flex items-center justify-center shadow-lg active:scale-95">
                                <span>VERIFY & CONTINUE</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 6: DOSING */}
            {step === 'dosing' && (
                <div className="space-y-6">
                    <button onClick={() => setStep(state.selectedFormDef?.requiresPreparation ? 'preparation' : 'strength')} className="flex items-center text-[#0077b6] font-bold text-sm bg-white px-6 py-3 rounded-full shadow-md"><ArrowLeft className="h-4 w-4 mr-2" /> Back</button>
                    <div className="bg-white dark:bg-slate-900 rounded-[40px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800">
                        <div className={`p-6 text-white flex items-center justify-between transition-colors ${doseAudit.status === 'IMPOSSIBLE' ? 'bg-red-600' : doseAudit.status === 'ATYPICAL' ? 'bg-amber-500' : 'bg-[#0077b6]'}`}>
                            <div className="flex items-center space-x-4">
                                <HeartPulse className="h-6 w-6" />
                                <div className="text-xl font-black uppercase tracking-tighter">THERAPEUTIC ORDER</div>
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">{physAudit.stageLabel}</div>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Layers className="h-5 w-5 text-[#0077b6]" />
                                    <span className="font-black text-xs uppercase text-slate-700">{state.strength}</span>
                                </div>
                                <span className="font-bold text-[10px] text-slate-400 tracking-widest uppercase">{state.route}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <InputWell label="Single Dose" value={state.dose} onChange={v => setState({...state, dose: v})} isError={doseAudit.status === 'IMPOSSIBLE'} />
                                <div className="p-5 bg-slate-50 rounded-[24px] border-2 border-slate-100 flex flex-col justify-center">
                                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1">Unit</label>
                                    <select value={state.doseUnit} onChange={e => setState({...state, doseUnit: e.target.value})} className="bg-transparent font-black text-2xl text-[#0077b6] outline-none">
                                        <option value="mg/kg">mg/kg</option>
                                        <option value="mg">mg</option>
                                        <option value="g">g</option>
                                    </select>
                                </div>
                            </div>

                            {doseAudit.message && (
                                <div className={`p-4 rounded-xl border-2 flex items-start space-x-3 animate-fade-in ${doseAudit.status === 'IMPOSSIBLE' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                    <AlertOctagon className="h-6 w-6 flex-shrink-0" />
                                    <span className="text-xs font-black uppercase leading-tight">{doseAudit.message}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                {['BD', 'TDS', 'QID'].map(f => (
                                    <button key={f} onClick={() => setState({...state, frequency: f})} className={`py-5 rounded-2xl font-black text-sm transition-all ${state.frequency === f ? 'bg-[#0077b6] text-white shadow-xl' : 'bg-slate-50 text-slate-400'}`}>{f}</button>
                                ))}
                            </div>

                            <button disabled={doseAudit.status === 'IMPOSSIBLE' || !state.dose} onClick={() => { setCalcResult(runCalculation(state)); setStep('results'); }} className={`w-full h-16 rounded-[32px] font-black text-lg flex items-center justify-center space-x-4 transition-all ${(!state.dose || doseAudit.status === 'IMPOSSIBLE') ? 'bg-slate-100 text-slate-300' : 'bg-[#0077b6] text-white shadow-xl active:scale-95'}`}>
                                <CheckCircle2 className="h-6 w-6" />
                                <span>EXECUTE CALCULATION</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 7: RESULTS */}
            {step === 'results' && calcResult && (
                <div className="animate-fade-in text-center space-y-8">
                    <button onClick={() => setStep('dosing')} className="inline-flex items-center text-[#0077b6] font-bold text-sm bg-white px-8 py-4 rounded-full shadow-lg border active:scale-95"><ArrowLeft className="h-4 w-4 mr-2" /> Modify Dose</button>
                    
                    <div className="bg-white rounded-[56px] shadow-3xl border-[12px] border-[#0077b6] overflow-hidden">
                        <div className="bg-[#0077b6] p-10 text-white">
                            <div className="text-[10px] font-black uppercase tracking-[0.5em] opacity-60 mb-2">Final Patient Volume</div>
                            <div className="text-6xl font-black tracking-tighter leading-none my-4">{calcResult.output.calculatedDose}</div>
                            <div className="py-2.5 px-6 bg-white/20 rounded-full inline-block text-[10px] font-black uppercase tracking-widest">{state.route} • {calcResult.output.totalMg} PER DOSE</div>
                        </div>
                        
                        <div className="p-8 space-y-3 text-left bg-slate-50">
                            {calcResult.output.unitsNeeded > 1 && (
                                <div className="p-5 bg-amber-100 border-2 border-amber-300 rounded-[32px] flex items-center space-x-4 mb-2 animate-bounce">
                                    <AlertTriangle className="h-6 w-6 text-amber-700 flex-shrink-0" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-amber-600">Dispensing Alert</div>
                                        <div className="text-sm font-black text-amber-900 leading-none mt-0.5">USE {calcResult.output.unitsNeeded} SEPARATE {state.form.toUpperCase()}S</div>
                                    </div>
                                </div>
                            )}

                            {calcResult.output.steps.map((s: string, i: number) => (
                                <div key={i} className="flex items-center space-x-4 p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm transition-all hover:scale-[1.01]">
                                    <CheckCircle2 className="h-5 w-5 text-[#0077b6] flex-shrink-0" />
                                    <p className="text-[13px] font-bold text-slate-700 leading-tight">{s}</p>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 pt-0">
                            <button onClick={() => setStep('admission')} className="w-full py-5 rounded-full bg-slate-900 text-white font-black text-sm uppercase tracking-widest">New Patient Audit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const InputWell = ({ label, value, onChange, isError }: any) => (
    <div className={`p-6 rounded-[24px] border-2 transition-all min-h-[120px] flex flex-col justify-between shadow-sm ${isError ? 'bg-red-50 border-red-400' : 'bg-slate-50 border-slate-100 focus-within:border-[#0077b6]'}`}>
        <label className={`block text-[9px] font-black uppercase tracking-widest mb-1 ${isError ? 'text-red-500' : 'text-slate-400'}`}>{label}</label>
        <input type="number" value={value} onChange={e => onChange(e.target.value)} className={`w-full bg-transparent border-none p-0 text-4xl font-black outline-none ${isError ? 'text-red-600' : 'text-[#0077b6]'}`} placeholder="0" />
    </div>
);

export default DrugCalculator;
