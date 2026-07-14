
export interface NewsArticle {
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  timestamp: string;
  imageUrl?: string;
}

export interface DrugInteraction {
  severity: 'Major' | 'Moderate' | 'Minor' | 'None';
  description: string;
  mechanism?: string;
  management?: string;
  pair: [string, string];
}

export interface DrugInteractionResult {
  interactions: DrugInteraction[];
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

export interface CalculationResult {
  variables: { name: string; value: string }[];
  formula: string;
  steps: string[];
  result: string;
  disclaimer: string;
}

export enum AppView {
  NEWS = 'NEWS',
  DRUGS = 'DRUGS', 
  CALCULATORS = 'CALCULATORS',
  SCORES = 'SCORES', 
  BUNDLES = 'BUNDLES', 
  PROCEDURES = 'PROCEDURES', 
  CLINICAL_ASSISTANT = 'CLINICAL_ASSISTANT',
  EMR = 'EMR'
}

export type CalculatorType = 
  | 'vasopressor' 
  | 'antibiotic' 
  | 'electrolyte' 
  | 'blood' 
  | 'simple' 
  | 'standard_infusion'
  | 'universal';

export type DrugForm = 
  | 'vial' | 'tablet' | 'capsule' | 'suspension' | 'drops' | 'liquid' | 'granules';

export type DoseBasis = 'weight' | 'ibw' | 'bsa' | 'fixed';

export type DrugGroup = 
  | 'vasopressor' | 'antibiotic' | 'analgesic' | 'electrolyte' | 'blood' | 'general' | 'anesthetic';

export type Route = 
  | 'IV' | 'IM' | 'SC' | 'ID' | 'PO' | 'SL' | 'PR' | 'TOP' | 'INH' | 'IO' | 'NEB' | 'NG' | 'OG' | 'JT';

export interface DoseRange {
    min: number;
    max: number;
    toxic: number;
    unit: string;
}

export interface IndicationProtocol {
    name: string;
    // Age-Bracketed Ranges
    neonateRange?: DoseRange;
    infantRange?: DoseRange;
    pediatricRange?: DoseRange;
    adultRange?: DoseRange;
    frequency: string[];
    maxDailyDose: number; // Hard ceiling in mg
    maxSingleDose: number; // Hard ceiling in mg
}

export interface DrugFormDefinition {
    type: DrugForm;
    strengths: string[];
    allowedRoutes: Route[];
    requiresPreparation: boolean;
    preparationType?: 'reconstitution' | 'dilution';
}

export interface DrugDefinition {
    id: string;
    label: string;
    group: DrugGroup;
    calcType: CalculatorType;
    indications: IndicationProtocol[];
    forms: DrugFormDefinition[];
    allowedUnits: string[];
}

export interface PatientProfile {
    ipNo: string;
    age: string;
    gender: 'male' | 'female';
    weight: string;
    height: string;
    bmi: number;
    bsa: number;
    ibw: number;
}

export interface ClinicalSafetySummaryData {
  patientSnapshot: string;
  renalCheck: string;
  coagulationCheck: string;
  neuroStatus: string;
  respiratorySafety: string;
  hemodynamicGoals: string;
  lineSafety: string;
  ongoingMonitoring: string;
  sofaContext: string;
}

export interface PatientPlanItem {
    id: string;
    text: string;
    status: 'pending' | 'done';
}

export interface PatientTask {
    id: string;
    category: 'Before round' | 'After round' | 'Intern' | 'Resident' | 'Ward sister' | 'Urgent' | 'Special';
    title: string;
    assignedTo: string;
    priority: 'Urgent' | 'Routine' | 'General';
    dueTime?: string;
    status: 'pending' | 'done';
    remarks?: string;
    completedBy?: string;
    completedTime?: string;
}

export interface PatientAttachment {
    id: string;
    type: 'xray' | 'report' | 'other';
    url: string;
    name: string;
    timestamp: string;
    aiInterpretation?: string;
}

export interface OrthoVitals {
    bp: string;
    pulse: number;
    temp: number;
    rr: number;
    spo2: number;
    timestamp: string;
}

export interface OrthoHistory {
    chiefComplaint: string;
    hpi: string;
    pmh: string;
    psh: string;
    medications: string;
    allergies: string;
    socialHistory: string;
    socratesSite?: string;
    socratesOnset?: string;
    socratesCharacter?: string;
    socratesRadiation?: string;
    socratesAssociations?: string;
    socratesTiming?: string;
    socratesExacerbating?: string;
    socratesSeverity?: number | string;
}

export interface BodySystemExam {
    status: 'Not Examined' | 'Examined' | 'Abnormal';
    notes: string;
}

export interface MedicalQuestionnaireItem {
    id: string;
    question: string;
    checked: boolean;
}

export interface OrthoPhysicalExam {
    general: string;
    vitals?: OrthoVitals;
    localExam: {
        inspection: string;
        palpation: string;
        movements: string;
        neurovascular: string;
        specialTests?: string;
    };
    bodySystems?: Record<string, BodySystemExam>;
    medicalQuestionnaire?: MedicalQuestionnaireItem[];
}

export interface DailyProgressNote {
    id: string;
    date: string;
    vitals?: OrthoVitals;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    drainage?: string;
    mobilization?: string;
    addedBy: string;
}

export interface StructuredInvestigation {
    id: string;
    type: 'Blood' | 'Urine' | 'Radiology' | 'Fluids' | 'Histopath' | 'Other';
    name: string;
    status: 'Not ordered' | 'Ordered' | 'Sent' | 'Report pending' | 'Received' | 'Reviewed' | 'Send' | 'Sample Sent' | 'Report Pending' | 'Came';
    result: string;
    updatedAt: string;
    orderedAt?: string;
    isManual?: boolean;
}

export interface OrthoPatient {
    id: string;
    demographics: {
        name: string;
        age: number | string;
        sex: 'M' | 'F' | 'Other';
        mobile: string;
        bedNumber: string;
        hospitalId: string; // Generic Hospital ID
        sbhNumber: string; // SBH/SBHF specific ID
        rank?: string;
        unit?: string;
        address?: string;
        computerNo?: string;
        admissionDate?: string;
        encounterSource?: string;
        admissionCategory?: string;
    };
    diagnosis: string;
    moi?: string;
    injuryDate?: string;
    injuryTime?: string;
    classification?: string;
    fractureType?: string;
    surgicalProcedure?: string;
    comorbidities: string[];
    status: string; // e.g., Pre-Op, Post-Op Day 2
    history?: OrthoHistory;
    physicalExam?: OrthoPhysicalExam;
    investigations: {
        blood: string;
        urine: string;
        imaging: string;
        others?: string;
        hbHistory?: { id: string; date: string; hb: number }[];
        structuredList?: StructuredInvestigation[];
    };
    plan: PatientPlanItem[];
    attachments: PatientAttachment[];
    soapNote?: string;
    hospitalCourse?: string;
    dailyNotes?: DailyProgressNote[];
    preOpChecklist?: string[];
    admissionChecklist?: string[];
    morningProgress?: string[];
    specialAdvice?: string;
    dangerSigns?: string[];
    dischargeNote?: string;
    dischargeDrafts?: { id: string, date: string, content: string }[];
    followUpDate?: string;
    nurseHandover?: string;
    nurseHandovers?: { id: string; date: string; text: string; addedBy: string }[];
    procedureDurationHistory?: { id: string; date: string; procedureName: string; durationSeconds: number; notes?: string }[];
    plannedSurgeryTime?: string;
    quickNotes?: string;
    quickNotesCategory?: 'Urgent' | 'Routine' | 'General';
    // Structured clinical modules added for G-MED 3.0
    pacAirwayGrade?: string;
    pacNpoStatus?: string;
    pacAsaClass?: string;
    pacStatus?: string;
    pacClearedDate?: string;
    consultCardioClearance?: string;
    consultMedClearance?: string;
    consultPulmoClearance?: string;
    consultNotes?: string;
    opTourniquetTimeInflated?: string;
    opTourniquetTimeDeflated?: string;
    opAnesthesiaType?: string;
    opSurgeon?: string;
    opImplantLot?: string;
    opSkinClosure?: string;
    opIntraOpNotes?: string;
    postOpDressing?: string;
    postOpPulses?: string;
    postOpHb?: string;
    postOpDay?: string;
    postOpAnalgesia?: string;
    followUpPeriod?: string;
    followUpSutureRemoval?: string;
    followUpWeightBearing?: string;
    followUpAdvice?: string;
    otNumber?: string;
    tasks?: PatientTask[];
    otSequence?: number;
    estimatedDurationMinutes?: number;
    surgerySide?: 'Right' | 'Left' | 'Bilateral';
    isImplantReady?: boolean;
    isInstrumentReady?: boolean;
    isC_armNeeded?: boolean;
    isTourniquetNeeded?: boolean;
    bloodRequirementText?: string;
    specialPositionText?: string;
    infectionPrecautionChecked?: boolean;
    pacNotFitReasonChecklist?: string[];
    consultSpecialty?: string;
    consultStatus?: 'Requested' | 'Seen' | 'Advice Given' | 'Follow-up' | 'Completed';
}

