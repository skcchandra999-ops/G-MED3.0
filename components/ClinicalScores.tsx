import React, { useState } from 'react';
import { Activity, Brain, HeartPulse, Scale, AlertTriangle } from 'lucide-react';

const ClinicalScores: React.FC = () => {
    const [activeScore, setActiveScore] = useState<'qSOFA' | 'GCS' | 'MAP' | 'BMI'>('qSOFA');

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-2">
                <h2 className="text-2xl font-bold text-slate-900">Clinical Scores & Calculators</h2>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide bg-white rounded-t-xl px-2">
                {[
                    { id: 'qSOFA', label: 'qSOFA (Sepsis)', icon: AlertTriangle },
                    { id: 'GCS', label: 'GCS (Neuro)', icon: Brain },
                    { id: 'MAP', label: 'MAP Calc', icon: HeartPulse },
                    { id: 'BMI', label: 'BMI', icon: Scale },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveScore(tab.id as any)}
                        className={`
                            px-4 py-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap flex items-center
                            ${activeScore === tab.id 
                                ? 'border-med-600 text-med-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-700'}
                        `}
                    >
                        <tab.icon className="h-4 w-4 mr-2" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 p-6 min-h-[400px]">
                {activeScore === 'qSOFA' && <QSOFACalculator />}
                {activeScore === 'GCS' && <GCSCalculator />}
                {activeScore === 'MAP' && <MAPCalculator />}
                {activeScore === 'BMI' && <BMICalculator />}
            </div>
        </div>
    );
};

const QSOFACalculator: React.FC = () => {
    const [hypotension, setHypotension] = useState(false);
    const [alteredMental, setAlteredMental] = useState(false);
    const [tachypnea, setTachypnea] = useState(false);

    const score = (hypotension ? 1 : 0) + (alteredMental ? 1 : 0) + (tachypnea ? 1 : 0);
    const highRisk = score >= 2;

    return (
        <div className="max-w-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">quick Sepsis Related Organ Failure Assessment (qSOFA)</h3>
            <p className="text-slate-500 mb-6 text-sm">Identifies patients with suspected infection who are at high risk for poor outcomes outside the ICU.</p>
            
            <div className="space-y-4 mb-8">
                <label className="flex items-center p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={hypotension} onChange={e => setHypotension(e.target.checked)} className="h-5 w-5 text-med-600 rounded" />
                    <div className="ml-3">
                        <span className="block font-medium text-slate-900">Hypotension</span>
                        <span className="block text-sm text-slate-500">Systolic BP ≤ 100 mmHg</span>
                    </div>
                </label>
                <label className="flex items-center p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={alteredMental} onChange={e => setAlteredMental(e.target.checked)} className="h-5 w-5 text-med-600 rounded" />
                    <div className="ml-3">
                        <span className="block font-medium text-slate-900">Altered Mental Status</span>
                        <span className="block text-sm text-slate-500">GCS &lt; 15</span>
                    </div>
                </label>
                <label className="flex items-center p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={tachypnea} onChange={e => setTachypnea(e.target.checked)} className="h-5 w-5 text-med-600 rounded" />
                    <div className="ml-3">
                        <span className="block font-medium text-slate-900">Tachypnea</span>
                        <span className="block text-sm text-slate-500">Respiratory rate ≥ 22 /min</span>
                    </div>
                </label>
            </div>

            <div className={`p-6 rounded-xl border ${highRisk ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Total Score</span>
                    <span className={`text-4xl font-bold ${highRisk ? 'text-red-700' : 'text-green-700'}`}>{score} / 3</span>
                </div>
                <div className={`text-lg font-medium ${highRisk ? 'text-red-800' : 'text-green-800'}`}>
                    {highRisk ? 'High Risk of Poor Outcome' : 'Low Risk (Not High Risk for Sepsis)'}
                </div>
                {highRisk && (
                    <p className="mt-2 text-sm text-red-700">A score ≥ 2 suggests a greater risk of prolonged ICU stay or in-hospital mortality. Assess for evidence of organ dysfunction.</p>
                )}
            </div>
        </div>
    );
};

const GCSCalculator: React.FC = () => {
    const [eye, setEye] = useState(4);
    const [verbal, setVerbal] = useState(5);
    const [motor, setMotor] = useState(6);

    const score = eye + verbal + motor;

    return (
        <div className="max-w-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Glasgow Coma Scale (GCS)</h3>
            
            <div className="space-y-6 mb-8">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Eye Opening</label>
                    <select value={eye} onChange={e => setEye(Number(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg bg-white">
                        <option value={4}>4 - Spontaneously</option>
                        <option value={3}>3 - To speech</option>
                        <option value={2}>2 - To pain</option>
                        <option value={1}>1 - None</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Verbal Response</label>
                    <select value={verbal} onChange={e => setVerbal(Number(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg bg-white">
                        <option value={5}>5 - Oriented</option>
                        <option value={4}>4 - Confused</option>
                        <option value={3}>3 - Inappropriate words</option>
                        <option value={2}>2 - Incomprehensible sounds</option>
                        <option value={1}>1 - None</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Motor Response</label>
                    <select value={motor} onChange={e => setMotor(Number(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg bg-white">
                        <option value={6}>6 - Obeys commands</option>
                        <option value={5}>5 - Localizes pain</option>
                        <option value={4}>4 - Withdraws from pain</option>
                        <option value={3}>3 - Flexion to pain (decorticate)</option>
                        <option value={2}>2 - Extension to pain (decerebrate)</option>
                        <option value={1}>1 - None</option>
                    </select>
                </div>
            </div>

            <div className="p-6 rounded-xl bg-slate-100 border border-slate-200">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-500">GCS Score</span>
                    <span className="text-4xl font-bold text-med-900">{score} / 15</span>
                </div>
                <div className="mt-2 text-slate-600 text-sm">
                    {score <= 8 ? 'Severe Head Injury (Coma)' : score <= 12 ? 'Moderate Head Injury' : 'Mild Head Injury'}
                </div>
            </div>
        </div>
    );
};

const MAPCalculator: React.FC = () => {
    const [sbp, setSbp] = useState('');
    const [dbp, setDbp] = useState('');

    const map = sbp && dbp ? (Number(sbp) + 2 * Number(dbp)) / 3 : null;

    return (
        <div className="max-w-xl">
             <h3 className="text-xl font-bold text-slate-800 mb-4">Mean Arterial Pressure (MAP)</h3>
             <div className="grid grid-cols-2 gap-4 mb-6">
                 <div>
                     <label className="block text-xs font-medium text-slate-700 mb-1">Systolic BP (mmHg)</label>
                     <input type="number" value={sbp} onChange={e => setSbp(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg" />
                 </div>
                 <div>
                     <label className="block text-xs font-medium text-slate-700 mb-1">Diastolic BP (mmHg)</label>
                     <input type="number" value={dbp} onChange={e => setDbp(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg" />
                 </div>
             </div>
             
             {map !== null && (
                 <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center">
                     <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">MAP</div>
                     <div className="text-4xl font-bold text-med-900 my-2">{map.toFixed(0)} <span className="text-base font-normal text-slate-500">mmHg</span></div>
                 </div>
             )}
        </div>
    );
};

const BMICalculator: React.FC = () => {
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');

    const bmi = height && weight ? Number(weight) / ((Number(height)/100) ** 2) : null;

    const getBMICategory = (val: number) => {
        if (val < 18.5) return "Underweight";
        if (val < 25) return "Normal weight";
        if (val < 30) return "Overweight";
        return "Obese";
    };

    return (
        <div className="max-w-xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Body Mass Index (BMI)</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
                 <div>
                     <label className="block text-xs font-medium text-slate-700 mb-1">Height (cm)</label>
                     <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg" />
                 </div>
                 <div>
                     <label className="block text-xs font-medium text-slate-700 mb-1">Weight (kg)</label>
                     <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg" />
                 </div>
             </div>

             {bmi !== null && (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">BMI</div>
                    <div className="text-4xl font-bold text-med-900 my-2">{bmi.toFixed(1)}</div>
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        bmi < 18.5 ? 'bg-blue-100 text-blue-800' : 
                        bmi < 25 ? 'bg-green-100 text-green-800' : 
                        bmi < 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                    }`}>
                        {getBMICategory(bmi)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClinicalScores;