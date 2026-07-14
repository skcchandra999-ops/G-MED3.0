
export const ORTHO_CATEGORIES = {
    "Trauma - Lower Limb": [
        "# Shaft of Femur",
        "# Neck of Femur",
        "# Intertrochanteric Femur",
        "# Subtrochanteric Femur",
        "# Distal Femur",
        "# Tibial Plateau",
        "# Shaft of Tibia",
        "# Pilon Fracture",
        "# Bimalleolar Ankle",
        "# Trimalleolar Ankle",
        "# Calcaneum",
        "# Talus Fracture",
        "# Lisfranc Injury"
    ],
    "Trauma - Upper Limb": [
        "# Proximal Humerus",
        "# Shaft of Humerus",
        "# Intercondylar Humerus",
        "# Olecranon",
        "# Both Bone Forearm",
        "# Distal Radius (Colles)",
        "# Smith's Fracture",
        "# Barton's Fracture",
        "# Scaphoid Fracture",
        "# Clavicle",
        "# AC Joint Dislocation"
    ],
    "Trauma - Pelvis & Spine": [
        "Pelvic Ring Injury",
        "Acetabular Fracture",
        "# Spine (Thoracolumbar)",
        "# Spine (Cervical)",
        "Spinal Cord Injury (SCI)",
        "Sacral Fracture",
        "Traumatic Paraplegia"
    ],
    "Cold Orthopaedics": [
        "B/L Osteoarthritis Knee",
        "Osteoarthritis Hip (AVN)",
        "Avascular Necrosis (AVN) Hip",
        "Lumbar Disc Prolapse (PIVD)",
        "Cervical Spondylosis / Myelopathy",
        "Lumbar Canal Stenosis",
        "Spondylolisthesis",
        "Primary Frozen Shoulder",
        "Recurrent Shoulder Dislocation",
        "Arthroscopic Knee (ACL/PCL Tear)",
        "Meniscal Tear (Medial/Lateral)",
        "Tennis Elbow / Golfer's Elbow",
        "Carpal Tunnel Syndrome (CTS)",
        "Plantar Fasciitis / Calcaneal Spur",
        "CTEV (Clubfoot Management)",
        "DDH (Developmental Dysplasia)",
        "Non-Union / Mal-Union Bone",
        "Genu Valgum / Varum Correction",
        "Hallux Valgus",
        "Trigger Finger",
        "Ganglion Cyst",
        "Gouty Arthritis"
    ],
    "Infections/Tumors": [
        "Septic Arthritis",
        "Chronic Osteomyelitis",
        "Pyogenic Osteomyelitis",
        "Tuberculosis Spine (Pott's)",
        "Giant Cell Tumor",
        "Osteochondroma",
        "Osteosarcoma",
        "Ewing's Sarcoma"
    ]
};

export const COMMON_PROCEDURES = [
    "CRIF with ILN Femur",
    "CRIF with ILN Tibia",
    "ORIF with DLS / Locking Plate",
    "ORIF with Multi-axial Locking Plate",
    "ORIF with Tension Band Wiring (TBW)",
    "Hemiarthroplasty (Austin Moore / Thompson)",
    "Bipolar Hemiarthroplasty",
    "Total Hip Replacement (THR)",
    "Total Knee Replacement (TKR)",
    "Arthroscopic ACL Reconstruction",
    "Debridement & External Fixation",
    "Illizarov Fixation",
    "Closed Reduction & K-Wire Fixation",
    "Tendon Repair",
    "Nerve Repair / Neurolysis",
    "Amputation (BKA / AKA)"
];

export const ORTHO_CLASSIFICATIONS = [
    "AO/OTA Classification",
    "Gustilo-Anderson (Open Fractures)",
    "Garden's (Neck of Femur)",
    "Boyd & Griffin (IT Fracture)",
    "Schatzker (Tibial Plateau)",
    "Neer's (Proximal Humerus)",
    "Lauge-Hansen (Ankle)",
    "Frykman (Distal Radius)",
    "Kellgren-Lawrence (OA Knee)",
    "Ficat & Arlet (AVN Hip)"
];

export const ORTHO_DIAGNOSES = Object.values(ORTHO_CATEGORIES).flat();

export const PATIENT_STATUSES = [
    "Pre-Op Workup",
    "Planned for OT",
    "Post-Op Day 0",
    "Post-Op Day 1",
    "Post-Op Day 2",
    "Post-Op Day 3",
    "Post-Op Day 4",
    "Post-Op Day 5",
    "Conservative Management",
    "Ready for Discharge",
    "Follow-up"
];

export const MORNING_PROGRESS_ITEMS = [
    "Pain intensity (VAS)",
    "Fever spikes last 24h",
    "Vitals stable",
    "Dressing / Wound soakage",
    "Distal neurovascular status",
    "Bladder/Bowel function",
    "Physio compliance",
    "Analgesia adequacy"
];

export const ADMISSION_CHECKLIST = [
    "Consent for Admission",
    "ID Band Applied",
    "Baseline Vitals Recorded",
    "Admission Labs Sent",
    "X-rays Completed",
    "Treatment Chart Initiated",
    "Nursing Assessment Done",
    "Attendant Info Collected"
];

export const DAILY_WARD_DUTIES = [
    "Morning Round Summaries",
    "Investigation Follow-ups",
    "New Admissions Workup",
    "Discharge Summaries",
    "Operation Theater List Prep",
    "Consent for Procedures",
    "Cross-consultations Sent"
];

export const COMORBIDITIES = [
    "Hypertension",
    "Type 2 Diabetes",
    "Bronchial Asthma",
    "COPD",
    "Hypothyroidism",
    "Chronic Kidney Disease",
    "CAD / Old MI",
    "Obesity",
    "Anemia",
    "None"
];

export const SMART_SUGGESTIONS = {
    "# Shaft of Femur": [
        "Check distal neurovascular status",
        "Apply skin traction",
        "X-ray R/L Femur AP/Lat",
        "Plan for ILN Femur",
        "LMWH for DVT prophylaxis"
    ],
    "B/L Osteoarthritis Knee": [
        "Standing X-ray both knees AP/Lat",
        "Check metabolic profile",
        "Plan for TKR",
        "Physiotherapy: Quad strengthening"
    ],
    "ACL Tear": [
        "MRI Knee R/L",
        "Check Lachman / Pivot Shift",
        "Physiotherapy: Pre-hab",
        "Plan for Arthroscopic ACL Reconstruction"
    ],
    "# Neck of Femur": [
        "Check comorbidities (Cardiac/Pulm)",
        "X-ray Pelvis with both hips AP",
        "Plan for Bipolar Hemiarthroplasty / THR",
        "LMWH for DVT prophylaxis"
    ],
    "Lumbar Disc Prolapse": [
        "MRI Lumbar Spine",
        "Check SLR / Neurological deficit",
        "Conservative: Bed rest, analgesics",
        "Plan for Microdiscectomy if worsening"
    ],
    "# Proximal Humerus": [
        "X-ray R/L Humerus AP/Scapular Y",
        "Check axillary nerve status",
        "Apply U-slab / Shoulder immobilizer"
    ]
};

export const COMMON_LABS = [
    { label: "Hb", unit: "g/dL", group: "Blood" },
    { label: "WBC", unit: "k", group: "Blood" },
    { label: "Platelets", unit: "k", group: "Blood" },
    { label: "Creatinine", unit: "mg/dL", group: "Renal" },
    { label: "Urea", unit: "mg/dL", group: "Renal" },
    { label: "Glucose", unit: "mg/dL", group: "Metabolic" },
    { label: "Sodium", unit: "mEq/L", group: "Electrolytes" },
    { label: "Potassium", unit: "mEq/L", group: "Electrolytes" }
];

export const PRE_OP_CHECKLIST = [
    "Informed Consent Signed",
    "PAC Clearance",
    "NPO from Midnight",
    "Surgical Site Marked",
    "Part Preparation Done",
    "Antibiotic Sensitivity Test",
    "Blood Arranged",
    "Implants Checked",
    "Checklist Finalized"
];

export const DANGER_SIGNS = [
    "Severe Pain (Unresponsive to Analgesics)",
    "Cold / Pale / Cyanosed Distal Limb",
    "Absence of Distal Pulses",
    "Progressive Neurological Deficit",
    "Excessive Wound Soakage / Active Bleed",
    "High Grade Fever (>101°F)",
    "Sudden Breathlessness / Chest Pain",
    "Tension / Hardness of Compartment"
];

export const SPECIAL_TESTS = {
    "Spine: Cervical": [
        "Spurling's Test +",
        "Distraction Test +",
        "Jackson Compression +",
        "Hoffman's Sign",
        "Lhermitte's Sign",
        "Upper Limb Tension (ULTT)"
    ],
    "Spine: Lumbar / LBP": [
        "SLRT + (Angle: )",
        "Lasegue Sign +",
        "Bowstring Sign +",
        "Crossed SLR +",
        "Slump Test +",
        "Thomas Test (FFD)",
        "Trendelenburg Sign",
        "Babinski Sign +",
        "Ankle Clonus"
    ],
    "Knee: All Tests": [
        "Lachman Test (ACL)",
        "Anterior Drawer (ACL)",
        "Pivot Shift (ACL)",
        "Posterior Drawer (PCL)",
        "Sag Sign (PCL)",
        "McMurray Medial (MM)",
        "McMurray Lateral (LM)",
        "Apley's Grind Test",
        "Thessaly Test",
        "Valgus Stress (MCL)",
        "Varus Stress (LCL)",
        "Patellar Apprehension",
        "Clarke's Sign (Patella)"
    ],
    "Brachial Plexus (Branches)": [
        "Axillary (Deltoid - Regimental)",
        "Musculocutan (Biceps - Lat Forearm)",
        "Radial (Wrist Drop / Finger Ext)",
        "Median (Pointing Index / Ape Thumb)",
        "Ulnar (Claw Hand / Interossei)",
        "Froment's Sign +",
        "Tinel's (Supraclavicular)",
        "Horner's Syndrome -"
    ],
    "Neurovascular (General)": [
        "CRT < 2s (Normal)",
        "Temp: Warm distal",
        "Pulses: Brachial 2+",
        "Pulses: Radial / Ulnar 2+",
        "Pulses: Femoral 2+",
        "Pulses: DP / PT 2+",
        "Sensory: C5-T1 Intact",
        "Sensory: L2-S1 Intact",
        "Motor: 5/5 Power",
        "Compartment: Soft/Pliable",
        "Danger Signs absent"
    ],
    "Hip & Pelvis": [
        "Galeazzi Sign",
        "Ober's Test (ITB)",
        "Patrick's (FABER)",
        "FADIR Test",
        "Fulcrum Test (Femur)"
    ]
};

export const MOI_OPTIONS = [
    "RTA / RVA (Road Traffic Accident)",
    "Fall from Height",
    "Slip and Fall",
    "Sports Injury",
    "Physical Assault",
    "Industrial Accident",
    "Gunshot Wound",
    "Blast Injury",
    "Crush Injury",
    "Pathological Fracture",
    "Other"
];

export const TIME_OPTIONS = [
    "Morning (06:00 - 12:00)",
    "Afternoon (12:00 - 17:00)",
    "Evening (17:00 - 20:00)",
    "Night (20:00 - 00:00)",
    "Midnight / Late Night (00:00 - 06:00)",
    "08:00 AM",
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM (Noon)",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM",
    "06:00 PM",
    "07:00 PM",
    "08:00 PM",
    "09:00 PM",
    "10:00 PM",
    "11:00 PM",
    "12:00 AM (Midnight)",
    "01:00 AM",
    "02:00 AM",
    "03:00 AM",
    "04:00 AM",
    "05:00 AM"
];

