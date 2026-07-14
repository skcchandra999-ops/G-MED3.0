import React from 'react';
import DrugCalculator from './DrugCalculator';
import { Activity } from 'lucide-react';

const Calculators: React.FC = () => {
    return (
        <div className="animate-fade-in">
            <div className="flex items-center space-x-3 mb-5 px-1 pt-2">
                 <div className="w-8 h-8 bg-gradient-to-br from-[#0077b6] to-[#005f92] rounded-lg flex items-center justify-center shadow-md">
                    <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
                 </div>
                 <h1 className="text-xl font-extrabold tracking-tight text-[#0077b6] dark:text-[#0ea5e9]">
                    G-MED Drug Calc
                 </h1>
            </div>
            <DrugCalculator />
        </div>
    );
};

export default Calculators;