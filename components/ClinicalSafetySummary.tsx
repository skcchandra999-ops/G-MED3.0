import React from 'react';
import { ClinicalSafetySummaryData } from '../types';
import { 
    User, Droplet, Activity, Brain, Wind, Heart, Anchor, Clock, BarChart2, 
    AlertTriangle, Hand, Info
} from 'lucide-react';

interface Props {
    data: ClinicalSafetySummaryData;
    drugName: string;
    concentration: string;
}

const ClinicalSafetySummary: React.FC<Props> = ({ data, drugName, concentration }) => {
    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mt-8 animate-fade-in font-sans">
            {/* Header */}
            <div className="bg-yellow-50 p-6 border-b border-yellow-100 flex items-start space-x-4">
                <div className="bg-yellow-100 p-2 rounded-full">
                    <Hand className="h-6 w-6 text-yellow-700" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Nurse, here is your Quick ICU Medication Safety Summary</h3>
                    <p className="text-sm text-slate-600 mt-1">
                        Safety context for <span className="font-bold text-slate-900">{drugName}</span> administration.
                    </p>
                </div>
            </div>

            <div className="p-8 space-y-8">
                
                {/* 1. Patient Snapshot */}
                <Section 
                    icon={User} 
                    title="Patient Snapshot" 
                    color="text-slate-500"
                    bg="bg-slate-100"
                >
                    <p>{data.patientSnapshot}</p>
                </Section>

                {/* 2. Medication/Dose Context (Hybrid from Props + Data) */}
                <Section 
                    icon={Droplet} 
                    title="Medication & Concentration" 
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                >
                    <p className="font-medium text-slate-900 mb-1">{drugName}</p>
                    <p>Prepared Concentration: <span className="font-bold">{concentration}</span></p>
                </Section>

                {/* 3. Renal */}
                <Section 
                    icon={Droplet} 
                    title="Renal & Perfusion Check" 
                    color="text-red-500"
                    bg="bg-red-50"
                    isAlert
                >
                    <p>{data.renalCheck}</p>
                </Section>

                {/* 4. Coagulation */}
                <Section 
                    icon={Droplet} 
                    title="Coagulation / DIC Alert" 
                    color="text-indigo-500"
                    bg="bg-indigo-50"
                >
                    <p>{data.coagulationCheck}</p>
                </Section>

                {/* 5. Neuro */}
                <Section 
                    icon={Brain} 
                    title="Neurological Status" 
                    color="text-pink-500"
                    bg="bg-pink-50"
                >
                    <p>{data.neuroStatus}</p>
                </Section>

                {/* 6. Respiratory */}
                <Section 
                    icon={Wind} 
                    title="Respiratory Safety" 
                    color="text-blue-500"
                    bg="bg-blue-50"
                >
                    <p>{data.respiratorySafety}</p>
                </Section>

                {/* 7. Hemodynamic */}
                <Section 
                    icon={Heart} 
                    title="Hemodynamic Goals" 
                    color="text-red-500"
                    bg="bg-red-50"
                    isAlert
                >
                    <p>{data.hemodynamicGoals}</p>
                </Section>

                {/* 8. Line Safety */}
                <Section 
                    icon={Anchor} 
                    title="Line & Infusion Safety" 
                    color="text-slate-500"
                    bg="bg-slate-100"
                >
                    <p className="whitespace-pre-line">{data.lineSafety}</p>
                </Section>

                {/* 9. Monitoring */}
                <Section 
                    icon={Clock} 
                    title="Ongoing Monitoring" 
                    color="text-slate-900"
                    bg="bg-slate-200"
                >
                    <p>{data.ongoingMonitoring}</p>
                </Section>

                {/* 10. SOFA Context */}
                <Section 
                    icon={BarChart2} 
                    title="SOFA Context & Mortality Trend" 
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                >
                    <p>{data.sofaContext}</p>
                </Section>

            </div>

            {/* Disclaimer Footer */}
            <div className="bg-slate-50 p-6 border-t border-slate-200">
                <div className="flex items-start space-x-3 mb-4">
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-slate-900 text-sm">Safety Disclaimer</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            This summary is a support tool only and does not replace physician judgment, hospital policies, or direct clinical supervision.
                            Please verify all doses, dilutions, and infusion settings with the treating doctor before administration.
                            If any detail is unclear or does not match the patient's condition, consult the physician or ICU team immediately.
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 text-xs font-medium text-slate-400 pl-8">
                    <span>Thank You</span>
                    <span>—</span>
                    <span>safe administration always begins with you.</span>
                </div>
            </div>
        </div>
    );
};

// Helper Component for Sections
const Section: React.FC<{
    icon: any, 
    title: string, 
    children: React.ReactNode, 
    color: string, 
    bg: string,
    isAlert?: boolean
}> = ({ icon: Icon, title, children, color, bg, isAlert }) => (
    <div className="flex items-start group">
        <div className={`mr-4 mt-1 p-1.5 rounded-lg ${bg} ${color} flex-shrink-0 transition-transform group-hover:scale-110`}>
            <Icon className="h-4 w-4" />
        </div>
        <div>
            <h4 className={`text-sm font-bold mb-1 flex items-center ${isAlert ? 'text-red-700' : 'text-slate-800'}`}>
                {title}
            </h4>
            <div className="text-sm text-slate-600 leading-relaxed">
                {children}
            </div>
        </div>
    </div>
);

export default ClinicalSafetySummary;