
import { CalculatorType, DrugDefinition, DrugGroup, Route, DrugForm, DoseBasis, PatientProfile, DrugFormDefinition, DoseRange } from '../types';

export interface CalculatorState {
    patient: PatientProfile;
    drugId: string;
    route: Route;
    form: DrugForm;
    selectedFormDef: DrugFormDefinition | null;
    strength: string; 
    calcType: CalculatorType;
    indicationIdx: number;
    isAdultMode: boolean;
    renalImpairment: boolean;
    dose: string;
    doseUnit: string;
    basis: DoseBasis;
    frequency: string;
    diluentVolume: string; // mL
    finalConcentration: number; // mg/mL
}

export type ClinicalStatus = 'NORMAL' | 'ATYPICAL' | 'OUTLIER' | 'IMPOSSIBLE' | 'CRITICAL';

export interface ValidationResponse {
    status: ClinicalStatus;
    message: string | null;
    stageLabel: string;
    suggestion?: string; 
}

const GROWTH_MATRIX = [
    { id: 'neonate', label: 'Neonate', maxAge: 0.08, minWt: 1.5, maxWt: 7, minHt: 35, maxHt: 70, tallThreshold: 60, shortThreshold: 45 },
    { id: 'infant', label: 'Infant', maxAge: 1, minWt: 3, maxWt: 18, minHt: 45, maxHt: 95, tallThreshold: 85, shortThreshold: 55 },
    { id: 'pediatric', label: 'Child', maxAge: 12, minWt: 8, maxWt: 60, minHt: 70, maxHt: 165, tallThreshold: 155, shortThreshold: 85 },
    { id: 'teen', label: 'Adolescent', maxAge: 18, minWt: 25, maxWt: 150, minHt: 120, maxHt: 215, tallThreshold: 188, shortThreshold: 140 },
    { id: 'adult', label: 'Adult', maxAge: 150, minWt: 30, maxWt: 400, minHt: 130, maxHt: 250, tallThreshold: 210, shortThreshold: 140 }
];

export const DRUGS: DrugDefinition[] = [
    { 
        id: 'amoxicillin', 
        label: 'Amoxicillin', 
        group: 'antibiotic', 
        calcType: 'antibiotic',
        allowedUnits: ['mg', 'mg/kg', 'g'],
        indications: [
            { 
                name: 'Systemic Infection', 
                neonateRange: { min: 20, max: 30, toxic: 50, unit: 'mg/kg' },
                infantRange: { min: 20, max: 40, toxic: 60, unit: 'mg/kg' },
                pediatricRange: { min: 25, max: 90, toxic: 100, unit: 'mg/kg' },
                adultRange: { min: 250, max: 1000, toxic: 2000, unit: 'mg' },
                frequency: ['BD', 'TDS', 'QID'],
                maxDailyDose: 4000,
                maxSingleDose: 1500 
            }
        ],
        forms: [
            { 
                type: 'vial', 
                strengths: ['125mg Injection', '250mg Injection', '500mg Injection', '1000mg (1g) Injection'], 
                allowedRoutes: ['IV', 'IM', 'IO'], 
                requiresPreparation: true,
                preparationType: 'reconstitution'
            },
            { 
                type: 'suspension', 
                strengths: ['125mg/5mL', '250mg/5mL'], 
                allowedRoutes: ['PO', 'NG', 'OG', 'JT'], 
                requiresPreparation: true,
                preparationType: 'reconstitution'
            },
            { 
                type: 'tablet', 
                strengths: ['125mg', '250mg', '500mg'], 
                allowedRoutes: ['PO', 'NG', 'OG', 'JT'], 
                requiresPreparation: false 
            },
            { 
                type: 'capsule', 
                strengths: ['250mg', '500mg'], 
                allowedRoutes: ['PO', 'NG', 'OG', 'JT'], 
                requiresPreparation: false 
            }
        ]
    }
];

export const validatePhysiology = (p: PatientProfile): ValidationResponse => {
    const age = parseFloat(p.age);
    const weight = parseFloat(p.weight);
    const height = parseFloat(p.height);
    
    if (isNaN(age) || age < 0) return { status: 'NORMAL', message: "Age required to begin audit.", stageLabel: 'PENDING' };

    const stage = GROWTH_MATRIX.find(s => age <= s.maxAge) || GROWTH_MATRIX[GROWTH_MATRIX.length - 1];

    if (!isNaN(weight) && weight > 0) {
        if (weight < stage.minWt || weight > stage.maxWt) return { status: 'IMPOSSIBLE', message: `PHYSICAL ANOMALY: Weight (${weight}kg) is outside biological limits for ${stage.label}.`, stageLabel: 'LOCKED' };
    }

    if (!isNaN(height) && height > 0) {
        if (height < stage.minHt || height > stage.maxHt) return { status: 'IMPOSSIBLE', message: `PHYSICAL ANOMALY: Height (${height}cm) is outside biological limits for ${stage.label}.`, stageLabel: 'LOCKED' };
    }

    if (!isNaN(weight) && !isNaN(height) && weight > 0 && height > 0) {
        const bmi = weight / ((height / 100) ** 2);
        
        if (height >= stage.tallThreshold && stage.id !== 'adult') {
            return { status: 'ATYPICAL', message: `TALL STATURE: Height exceeds 95th percentile.`, stageLabel: 'TALL PERCENTILE' };
        }
        if (height <= stage.shortThreshold && stage.id !== 'adult') {
            return { status: 'ATYPICAL', message: `SHORT STATURE: Height below 5th percentile.`, stageLabel: 'SHORT PERCENTILE' };
        }

        if (age >= 18) {
            if (bmi >= 40) return { status: 'CRITICAL', message: `CLASS III OBESITY (BMI ${bmi.toFixed(1)}). Major anesthesia risk.`, stageLabel: 'OBESITY III' };
            if (bmi >= 30) return { status: 'CRITICAL', message: `CLASS I/II OBESITY (BMI ${bmi.toFixed(1)}). Adjust doses to Ideal Body Weight.`, stageLabel: 'OBESITY' };
        } else {
            if (bmi >= 30) return { status: 'CRITICAL', message: `PEDIATRIC OBESITY (BMI ${bmi.toFixed(1)}). Use adult caps for all drugs.`, stageLabel: 'PEDIATRIC OBESITY' };
        }
    }

    if (isNaN(weight) || weight === 0) return { status: 'NORMAL', message: "Weight required for clinical gatekeeper.", stageLabel: stage.label.toUpperCase() };

    return { status: 'NORMAL', message: 'Physiology audit successful.', stageLabel: stage.label.toUpperCase() };
};

export const validateTherapeuticDose = (s: CalculatorState): ValidationResponse => {
    const drug = DRUGS.find(d => d.id === s.drugId);
    if (!drug) return { status: 'NORMAL', message: null, stageLabel: 'SAFE' };

    const age = parseFloat(s.patient.age) || 0;
    const weight = parseFloat(s.patient.weight) || 0;
    const protocol = drug.indications[0];

    let activeRange: DoseRange | undefined;
    if (age <= 0.08) activeRange = protocol.neonateRange;
    else if (age <= 1) activeRange = protocol.infantRange;
    else if (age <= 12) activeRange = protocol.pediatricRange;
    else activeRange = protocol.adultRange;

    const doseVal = parseFloat(s.dose);
    if (isNaN(doseVal) || doseVal <= 0) return { status: 'NORMAL', message: null, stageLabel: 'PENDING' };

    // Absolute single dose in MG
    let totalMgSingle = 0;
    if (s.doseUnit === 'mg/kg') totalMgSingle = doseVal * weight;
    else if (s.doseUnit === 'g') totalMgSingle = doseVal * 1000;
    else totalMgSingle = doseVal;

    // HARD STOP: Toxicity check
    if (totalMgSingle > protocol.maxSingleDose) {
        return { status: 'IMPOSSIBLE', message: `TOXIC DOSE: ${totalMgSingle}mg exceeds the absolute single-dose safety cap (${protocol.maxSingleDose}mg).`, stageLabel: 'HARD STOP' };
    }

    if (activeRange) {
        if (activeRange.unit === 'mg/kg') {
            const mgKgActual = totalMgSingle / weight;
            if (mgKgActual > activeRange.toxic) {
                return { status: 'IMPOSSIBLE', message: `DOSE ERROR: ${mgKgActual.toFixed(1)}mg/kg is toxic for this age group (Max: ${activeRange.toxic}mg/kg).`, stageLabel: 'UNSAFE' };
            }
            if (mgKgActual < activeRange.min && !(age < 18 && weight >= 40 && totalMgSingle >= (protocol.adultRange?.min || 0))) {
                return { status: 'ATYPICAL', message: `SUB-THERAPEUTIC: ${mgKgActual.toFixed(1)}mg/kg is below minimum target.`, stageLabel: 'UNDERDOSE' };
            }
        } else {
            if (totalMgSingle > activeRange.toxic) return { status: 'IMPOSSIBLE', message: `DOSE ERROR: ${totalMgSingle}mg is toxic for age.`, stageLabel: 'HARD STOP' };
        }
    }

    return { status: 'NORMAL', message: null, stageLabel: 'SAFE' };
};

export const calculatePatientMetrics = (weight: number, height: number, gender: 'male' | 'female'): { bmi: number, bsa: number, ibw: number } => {
    if (!weight || !height || weight <= 0 || height <= 0) return { bmi: 0, bsa: 0, ibw: 0 };
    const bmi = weight / ((height / 100) ** 2);
    const bsa = Math.sqrt((height * weight) / 3600);
    const ibw = gender === 'male' ? 50 + 2.3 * ((height / 2.54) - 60) : 45.5 + 2.3 * ((height / 2.54) - 60);
    return { bmi: parseFloat(bmi.toFixed(1)), bsa: parseFloat(bsa.toFixed(2)), ibw: parseFloat(ibw.toFixed(1)) };
};

export const runCalculation = (s: CalculatorState): any => {
    const doseVal = parseFloat(s.dose);
    const weight = parseFloat(s.patient.weight);
    
    // Final Target Dose in Mg
    const doseMg = s.doseUnit === 'mg/kg' ? doseVal * weight : (s.doseUnit === 'g' ? doseVal * 1000 : doseVal);
    
    // Variable for source strength numeric value (e.g. 125 from "125mg/5mL")
    const match = s.strength.match(/(\d+)mg/);
    const sourceMg = match ? parseFloat(match[1]) : 1;
    
    const steps = ["Biometrics Audited", "Growth Stage Verified"];
    let resultVolumeStr = "";
    let unitsNeeded = 1;

    if (s.selectedFormDef?.requiresPreparation) {
        // Preparation logic (Liquids/Vials)
        const conc = s.finalConcentration; // mg/mL
        const mlToAdmin = doseMg / conc;
        resultVolumeStr = `${mlToAdmin.toFixed(2)} mL`;

        // How many source containers (vials/syrups) are needed?
        unitsNeeded = Math.ceil(doseMg / sourceMg);
        
        steps.push(`Target Dose: ${doseMg.toFixed(1)} mg`);
        steps.push(`Prepared Concentration: ${conc.toFixed(2)} mg/mL`);
        if (unitsNeeded > 1) {
            steps.push(`NOTE: This dose requires ${unitsNeeded} separate ${s.form} units (Total ${unitsNeeded * sourceMg}mg available).`);
        }
        steps.push(`Administer ${resultVolumeStr} of the prepared solution.`);
    } else {
        // Fixed forms logic (Tablets/Capsules)
        unitsNeeded = doseMg / sourceMg;
        resultVolumeStr = `${unitsNeeded.toFixed(1)} ${s.form}${unitsNeeded !== 1 ? 's' : ''}`;
        
        steps.push(`Target Dose: ${doseMg.toFixed(1)} mg`);
        steps.push(`Strength Used: ${sourceMg} mg per unit`);
        steps.push(`Dispense ${resultVolumeStr}`);
    }

    const freqDetail = s.frequency === 'BD' ? '12-hourly' : s.frequency === 'TDS' ? '8-hourly' : '6-hourly';
    steps.push(`Schedule: ${s.frequency} (${freqDetail})`);

    return { 
        output: { 
            calculatedDose: resultVolumeStr, 
            totalMg: `${doseMg.toFixed(1)} mg`,
            unitsNeeded,
            steps
        } 
    };
};
