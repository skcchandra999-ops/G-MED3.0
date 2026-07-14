import React, { useState } from 'react';
import { ClipboardList, Clock, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';

interface ChecklistItem {
    id: string;
    text: string;
    checked: boolean;
    time?: string;
}

const Bundles: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-2">
                <h2 className="text-2xl font-bold text-slate-900">Clinical Bundles & Checklists</h2>
            </div>
            
            <div className="grid gap-6">
                <BundleCard 
                    title="Sepsis Hour-1 Bundle" 
                    description="Surviving Sepsis Campaign Guidelines (2021)"
                    color="border-l-red-500"
                    items={[
                        { id: '1', text: 'Measure lactate level.', checked: false },
                        { id: '2', text: 'Obtain blood cultures before antibiotics.', checked: false },
                        { id: '3', text: 'Administer broad-spectrum antibiotics.', checked: false },
                        { id: '4', text: 'Begin rapid administration of 30mL/kg crystalloid for hypotension or lactate ≥ 4 mmol/L.', checked: false },
                        { id: '5', text: 'Apply vasopressors if hypotensive during or after fluid resuscitation to maintain MAP ≥ 65 mm Hg.', checked: false },
                    ]}
                />
                <BundleCard 
                    title="ICU Daily Safety Bundle (FAST HUGS)" 
                    description="Critical Care Daily Rounding Checklist"
                    color="border-l-indigo-500"
                    items={[
                        { id: '1', text: 'Feeding: Can patient be fed enterally?', checked: false },
                        { id: '2', text: 'Analgesia: Pain control adequate? Assessment score?', checked: false },
                        { id: '3', text: 'Sedation: Target RASS met? Daily interruption trial?', checked: false },
                        { id: '4', text: 'Thromboembolic Prophylaxis: Heparin/Lovenox ordered?', checked: false },
                        { id: '5', text: 'Head of Bed: Elevated 30-45 degrees?', checked: false },
                        { id: '6', text: 'Ulcer Prophylaxis: PPI/H2 blocker needed?', checked: false },
                        { id: '7', text: 'Glucose Control: Target 140-180 mg/dL?', checked: false },
                        { id: '8', text: 'Spontaneous Breathing Trial: Ready for extubation?', checked: false },
                    ]}
                />
                <BundleCard 
                    title="Anaphylaxis Immediate Management" 
                    description="Acute management steps"
                    color="border-l-amber-500"
                    items={[
                        { id: '1', text: 'Remove allergen / stop infusion.', checked: false },
                        { id: '2', text: 'Assess Airway, Breathing, Circulation, Mental Status.', checked: false },
                        { id: '3', text: 'IM Epinephrine (1:1000) 0.01 mg/kg (max 0.5mg) into mid-anterolateral thigh.', checked: false },
                        { id: '4', text: 'Place patient in supine position (unless respiratory distress).', checked: false },
                        { id: '5', text: 'High-flow oxygen.', checked: false },
                        { id: '6', text: 'IV Access + Fluids (1-2L bolus for adults).', checked: false },
                    ]}
                />
                <BundleCard 
                    title="DKA Initial Hour Bundle" 
                    description="Diabetic Ketoacidosis Management"
                    color="border-l-blue-500"
                    items={[
                        { id: '1', text: 'Start IV Fluids: 1000mL NS in first hour.', checked: false },
                        { id: '2', text: 'Check K+ (Potassium). Ensure > 3.3 before insulin.', checked: false },
                        { id: '3', text: 'Start IV Insulin Regular 0.1 units/kg/hr.', checked: false },
                        { id: '4', text: 'Check VBG/ABG and electrolytes q2h.', checked: false },
                    ]}
                />
            </div>
        </div>
    );
};

const BundleCard: React.FC<{title: string, description: string, color: string, items: ChecklistItem[]}> = ({ title, description, color, items: initialItems }) => {
    const [expanded, setExpanded] = useState(false);
    const [items, setItems] = useState<ChecklistItem[]>(initialItems);

    const toggleItem = (id: string) => {
        setItems(items.map(i => i.id === id ? { ...i, checked: !i.checked, time: !i.checked ? new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : undefined } : i));
    };

    const progress = Math.round((items.filter(i => i.checked).length / items.length) * 100);

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden border-l-4 ${color}`}>
            <div 
                className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div>
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-500">{description}</p>
                </div>
                <div className="flex items-center space-x-4">
                     <div className="text-right hidden sm:block">
                         <div className="text-sm font-bold text-slate-700">{progress}%</div>
                         <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1">
                             <div className="h-full bg-med-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                         </div>
                     </div>
                     {expanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                </div>
            </div>

            {expanded && (
                <div className="p-5 pt-0 border-t border-slate-100 bg-slate-50/50">
                    <div className="space-y-3 mt-4">
                        {items.map((item) => (
                            <div 
                                key={item.id} 
                                className={`
                                    flex items-start p-3 rounded-lg border transition-all cursor-pointer
                                    ${item.checked ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 hover:border-med-300'}
                                `}
                                onClick={() => toggleItem(item.id)}
                            >
                                <div className={`mt-0.5 mr-3 flex-shrink-0 ${item.checked ? 'text-green-600' : 'text-slate-300'}`}>
                                    <CheckSquare className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <span className={`text-sm ${item.checked ? 'text-green-900 font-medium' : 'text-slate-700'}`}>{item.text}</span>
                                </div>
                                {item.time && (
                                    <div className="flex items-center text-xs text-green-700 font-medium bg-green-100 px-2 py-1 rounded ml-2">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {item.time}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bundles;