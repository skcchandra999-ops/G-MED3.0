import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request limit for base64 xray images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to clean JSON string from Markdown code blocks
const cleanJSON = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
};

// Initialize Gemini
const getAi = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or API_KEY environment variable is not defined");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// --- API ROUTES FIRST ---

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 1. Chatbot streaming endpoint
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { history, message } = req.body;
    const ai = getAi();

    const systemInstruction = `You are the AI Engine for G-MED 3.0, a specialized Orthopedic Mini-EMR designed for high-volume residency management (100+ admitted cases). 

### YOUR CORE FUNCTIONS:
1. DATA ENTRY & CLEANING: Convert messy, shorthand resident notes into structured medical data.
2. ROUND SUMMARIZATION: Synthesize daily updates, vitals, and nursing notes into a formal SOAP (Subjective, Objective, Assessment, Plan) format.
3. TASK TRACKING: Identify "Pending" vs "Done" tasks from chat logs or notes.
4. IMAGE INTERPRETATION: Assist in describing X-ray findings (fracture line, displacement, angulation, implant status).

### DATA STRUCTURE REQUIREMENTS:
For every patient, you must organize information into these specific fields:
- Demographic: Name, Age, Sex, Bed Number, Hospital ID.
- Diagnosis: Primary Orthopedic Dx + Co-morbidities.
- Status: (e.g., Pre-Op, Post-Op Day X, Conservative).
- Investigations: Blood (Hb, WBC), Urine, Imaging (X-ray/CT/MRI).
- Plan/Pending: Clear bullet points of what needs to happen next.

### OUTPUT STYLE:
- Use professional medical terminology (e.g., use "distal neurovascular status intact" instead of "blood flow okay").
- Be concise. Use tables for bed-wise summaries.
- If the resident provides shorthand (e.g., "B12, #Femur, distal pulse +, plan OT tmrw"), expand it into a full professional entry.

### SAFETY & LIMITS:
- Always include the disclaimer: "AI-generated summary. Must be verified by the Resident/Attending."
- If data is missing (like a post-op Hb), flag it as "DATA MISSING" in the summary.`;

    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
      history: history,
    });

    const streamResponse = await chat.sendMessageStream({ message });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of streamResponse) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.end();
  } catch (error) {
    console.error("Server /api/gemini/chat failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// 2. Parse Shorthand to Orthopedic Patient Data
app.post("/api/gemini/parse-shorthand", async (req, res) => {
  try {
    const { shorthandNote, existingPatientData } = req.body;
    const ai = getAi();

    const prompt = `Convert the following messy, shorthand resident note into structured medical data for a High-Volume Orthopedic Mini-EMR.
        
        Resident Note: "${shorthandNote}"
        
        ${existingPatientData ? `Existing Context (merge carefully): ${JSON.stringify(existingPatientData)}` : ""}
        
        Extract information into the schema. Infer logical medical terms (e.g. # means fracture). 
        
        CRITICAL PARTITIONING RULES:
        - PALPATION: Local tenderness, temperature, crepitus, bony irregularities, swelling.
        - NEUROVASCULAR: All distal pulses (DPA, PTA, Radial, etc.), sensations, and motor function. Distal pulses MUST go in neurovascular, NOT palpation.
        - SPECIAL TESTS: Standard orthopedic tests like SLRT, Lachman, Drawer, McMurray, Trendelenburg, Thomas, Phalen, Tinel, Babinski.
        - BRACHIAL PLEXUS: Map tests related to Axillary, Musculocutaneous, Radial, Median, and Ulnar nerve branches to Special Tests.
        
        Ensure History and Physical Exam are structured if mentioned in shorthand.
        Identify mobile numbers or specific Hospital IDs (SBH/SBHF).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            demographics: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                age: { type: Type.NUMBER },
                sex: { type: Type.STRING, enum: ["M", "F", "Other"] },
                mobile: { type: Type.STRING },
                bedNumber: { type: Type.STRING },
                hospitalId: { type: Type.STRING },
                sbhNumber: { type: Type.STRING },
              },
            },
            diagnosis: { type: Type.STRING },
            comorbidities: { type: Type.ARRAY, items: { type: Type.STRING } },
            status: { type: Type.STRING },
            history: {
              type: Type.OBJECT,
              properties: {
                chiefComplaint: { type: Type.STRING },
                hpi: { type: Type.STRING },
                pmh: { type: Type.STRING },
                psh: { type: Type.STRING },
                medications: { type: Type.STRING },
                allergies: { type: Type.STRING },
                socialHistory: { type: Type.STRING },
              },
            },
            physicalExam: {
              type: Type.OBJECT,
              properties: {
                general: { type: Type.STRING },
                vitals: {
                  type: Type.OBJECT,
                  properties: {
                    bp: { type: Type.STRING },
                    pulse: { type: Type.NUMBER },
                    temp: { type: Type.NUMBER },
                    rr: { type: Type.NUMBER },
                    spo2: { type: Type.NUMBER },
                  },
                },
                localExam: {
                  type: Type.OBJECT,
                  properties: {
                    inspection: { type: Type.STRING },
                    palpation: { type: Type.STRING },
                    movements: { type: Type.STRING },
                    neurovascular: { type: Type.STRING },
                    specialTests: { type: Type.STRING },
                  },
                },
              },
            },
            investigations: {
              type: Type.OBJECT,
              properties: {
                blood: { type: Type.STRING },
                urine: { type: Type.STRING },
                imaging: { type: Type.STRING },
                others: { type: Type.STRING },
              },
            },
            plan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ["pending", "done"] },
                },
              },
            },
            soapNote: { type: Type.STRING },
          },
          required: ["demographics", "diagnosis", "status", "investigations", "plan", "soapNote"],
        },
        systemInstruction: `You are the AI Engine for G-MED 3.0, a specialized Orthopedic Mini-EMR.
1. DATA ENTRY & CLEANING: Convert messy, shorthand notes into structured data.
2. ROUND SUMMARIZATION: Synthesize daily updates into a formal SOAP note format.
3. STRUCTURED HISTORY & EXAM: Populate History and Physical Exam fields meticulously.
4. TASK TRACKING: Identify "Pending" vs "Done" tasks.
5. IMAGE INTERPRETATION: Describe X-ray findings if mentioned.
OUTPUT STYLE:
- Use professional terminology ("distal neurovascular status intact" not "blood flow okay").
- Concisely summarize in the "soapNote" field.`,
      },
    });

    res.json(JSON.parse(cleanJSON(response.text || "{}")));
  } catch (error) {
    console.error("Shorthand parsing failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// 3. Fetch Medical News
app.get("/api/gemini/medical-news", async (req, res) => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Generate 6 concise, professional medical news headlines that would be relevant to clinicians today. Cover topics like new drug approvals, major study findings, or public health updates. Return the result as a JSON array.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              source: { type: Type.STRING, description: "A plausible medical journal or news source name" },
              category: { type: Type.STRING, description: "e.g., Cardiology, Oncology, Public Health" },
              timestamp: { type: Type.STRING, description: "Relative time, e.g., '2 hours ago'" },
              url: { type: Type.STRING, description: "A placeholder URL" },
            },
            required: ["title", "summary", "source", "category", "timestamp", "url"],
          },
        },
        systemInstruction: "You are the G-MED 3.0 news aggregator. Provide realistic, high-quality medical news summaries.",
      },
    });

    res.json(JSON.parse(cleanJSON(response.text || "[]")));
  } catch (error) {
    console.error("Failed to fetch news:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// 4. Analyze Drug Interactions
app.post("/api/gemini/analyze-interactions", async (req, res) => {
  try {
    const { drugs } = req.body;
    const ai = getAi();
    const drugList = drugs.map((d: any) => d.dosage ? `${d.name} (${d.dosage})` : d.name).join(", ");
    const prompt = `Analyze the following list of drugs for potential drug-drug interactions: ${drugList}. 
    Provide a clinical summary and a list of specific interactions with severity levels (Major, Moderate, Minor).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            interactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING, enum: ["Major", "Moderate", "Minor", "None"] },
                  description: { type: Type.STRING },
                  mechanism: { type: Type.STRING },
                  management: { type: Type.STRING },
                  pair: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "The two drugs involved in this specific interaction",
                  },
                },
                required: ["severity", "description", "pair"],
              },
            },
          },
          required: ["summary", "interactions"],
        },
        systemInstruction: "You are a clinical pharmacology expert for G-MED 3.0. Be precise, conservative, and highlight dangerous interactions clearly.",
      },
    });

    res.json(JSON.parse(cleanJSON(response.text || "{}")));
  } catch (error) {
    console.error("Interaction check failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// 5. Calculate Medical Math
app.post("/api/gemini/calculate-math", async (req, res) => {
  try {
    const { query } = req.body;
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Solve this medical calculation request: "${query}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  value: { type: Type.STRING },
                },
              },
              description: "The variables extracted from the prompt (e.g., Weight: 80kg)",
            },
            formula: { type: Type.STRING, description: "The medical formula used" },
            steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Step by step solution" },
            result: { type: Type.STRING, description: "The final answer with units" },
            disclaimer: { type: Type.STRING, description: "Any warnings about the dose or calculation" },
          },
          required: ["variables", "formula", "steps", "result", "disclaimer"],
        },
        systemInstruction: "You are a precision medical calculator for G-MED 3.0. Extract variables, select the correct medical formula (e.g., Pediatric dosage, Parkland formula, Infusion rates), and solve step-by-step. If a drug dose seems unsafe, note it in the disclaimer.",
      },
    });

    res.json(JSON.parse(cleanJSON(response.text || "{}")));
  } catch (error) {
    console.error("Calculation failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// 6. Generate Drug Safety Summary
app.post("/api/gemini/safety-summary", async (req, res) => {
  try {
    const { drugName, patientWeight, dose, route } = req.body;
    const ai = getAi();
    const prompt = `Create a 'Quick ICU Medication Safety Summary' for a Nurse/Doctor for the following:
        Patient Weight: ${patientWeight}kg
        Drug: ${drugName}
        Dose/Order: ${dose} via ${route}
        
        Provide concise, high-value clinical pearls for the specific sections requested in the schema.
        Focus on critical care safety: renal adjustments, line extravasation risks, hemodynamic targets, and specific monitoring warnings.
        Be direct and professional.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientSnapshot: { type: Type.STRING, description: "Brief calc of BMI if height known (assume avg if not), and implication of weight." },
            renalCheck: { type: Type.STRING, description: "Renal perfusion, urine output goals, or dose adjustments." },
            coagulationCheck: { type: Type.STRING, description: "Bleeding risks, platelet thresholds, or interaction with anticoagulants." },
            neuroStatus: { type: Type.STRING, description: "GCS monitoring, sedation targets, or mental status changes." },
            respiratorySafety: { type: Type.STRING, description: "Respiratory drive, SpO2 goals, or airway risks." },
            hemodynamicGoals: { type: Type.STRING, description: "MAP targets, BP monitoring frequency, perfusion signs." },
            lineSafety: { type: Type.STRING, description: "Central vs Peripheral reqs, extravasation management, compatibility." },
            ongoingMonitoring: { type: Type.STRING, description: "Frequency of vitals, labs (lactate, lytes), and titrations." },
            sofaContext: { type: Type.STRING, description: "How this drug relates to SOFA score components (Cardio/Resp/Renal/Neuro)." },
          },
          required: ["patientSnapshot", "renalCheck", "coagulationCheck", "neuroStatus", "respiratorySafety", "hemodynamicGoals", "lineSafety", "ongoingMonitoring", "sofaContext"],
        },
        systemInstruction: "You are a senior ICU Clinical Pharmacist. Generate a structured safety summary similar to Medscape or UpToDate but optimized for bedside nursing safety checks.",
      },
    });

    res.json(JSON.parse(cleanJSON(response.text || "{}")));
  } catch (error) {
    console.error("Safety Summary generation failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// 7. Interpret X-ray Image
app.post("/api/gemini/interpret-xray", async (req, res) => {
  try {
    const { base64Image } = req.body;
    const ai = getAi();
    const cleanBase64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        "You are an expert orthopedic surgeon. Analyze this X-ray image and provide a professional description. Focus on: fracture line, displacement, angulation, and implant status if present. Use precise medical terminology. Be concise.",
        {
          inlineData: {
            data: cleanBase64,
            mimeType: "image/jpeg",
          },
        },
      ],
      config: {
        systemInstruction: "You are the AI Engine for G-MED 3.0, specializing in orthopedic image interpretation. Provide expert, professional descriptions.",
      },
    });

    res.json({ text: response.text || "" });
  } catch (error) {
    console.error("X-ray interpretation failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// 8. Compare X-ray Images
app.post("/api/gemini/compare-xrays", async (req, res) => {
  try {
    const { base64Image1, base64Image2, name1, name2 } = req.body;
    const ai = getAi();
    const cleanBase64_1 = base64Image1.includes(",") ? base64Image1.split(",")[1] : base64Image1;
    const cleanBase64_2 = base64Image2.includes(",") ? base64Image2.split(",")[1] : base64Image2;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        `You are an expert orthopedic surgeon. Compare these two X-ray images of the same patient.
        
        Image A: ${name1}
        Image B: ${name2}
        
        Please provide a professional, structured comparative analysis focusing on:
        1. Fracture line changes and healing/callus formation.
        2. Progression of displacement or angulation.
        3. Implant position, stability, or any hardware failure/signs of loosening.
        4. Overall alignment comparison.
        
        Start with a clear, high-level comparative summary, then provide section-by-section comparison. Use precise, standard medical terminology and ensure the tone is professional.`,
        {
          inlineData: {
            data: cleanBase64_1,
            mimeType: "image/jpeg",
          },
        },
        {
          inlineData: {
            data: cleanBase64_2,
            mimeType: "image/jpeg",
          },
        },
      ],
      config: {
        systemInstruction: "You are the AI Engine for G-MED 3.0, specializing in orthopedic image comparative analytics.",
      },
    });

    res.json({ text: response.text || "" });
  } catch (error) {
    console.error("X-ray comparison failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// 9. Course of Hospital Stay
app.post("/api/gemini/course-stay", async (req, res) => {
  try {
    const { patient } = req.body;
    const ai = getAi();
    const notesContent = patient.dailyNotes?.map((note: any) =>
      `Date: ${new Date(note.date).toLocaleDateString()} | S: ${note.subjective} | O: ${note.objective} | Vitals: BP ${note.vitals?.bp}, Pulse ${note.vitals?.pulse} | A: ${note.assessment} | P: ${note.plan}`
    ).join("\n\n") || "No daily notes available.";

    const prompt = `Synthesize the following daily progress notes into a single, professional medical paragraph describing the patient's course of hospital stay. Focus on clinical milestones, stability of vitals, surgical recovery, mobilization progress, and any complications or lack thereof.
    
    Patient Name: ${patient.demographics?.name}
    Diagnosis: ${patient.diagnosis}
    Procedure: ${patient.surgicalProcedure || "Conservative management"}
    
    Daily Progress Notes:
    ${notesContent}
    
    Requirements:
    - Professional medical terminology.
    - Chronological flow.
    - Concise and cohesive paragraph format.
    - Mention significant trends (e.g. "pain gradually improved", "mobilized to full weight bearing by POD 3").`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the G-MED 3.0 Clinical Narrative Engine. Synthesize daily clinical data into professional hospital course summaries.",
      },
    });

    res.json({ text: response.text || "" });
  } catch (error) {
    console.error("Course synthesis failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// 10. Discharge Summary
app.post("/api/gemini/discharge-summary", async (req, res) => {
  try {
    const { patient } = req.body;
    const ai = getAi();
    const prompt = `Generate a highly precise, smart, and comprehensive Discharge Summary for an orthopedic patient. 
    
Important Requirements:
1. Patient Friendly: Use clear, easy-to-understand language for follow-up instructions, mobilization rules, and warning signs.
2. Pharmacy Friendly: Format discharge medications clearly in a comprehensive Markdown table.
3. Nurse Friendly: Provide explicit instructions for wound care, drain removal, and exact follow-up/suture removal dates.

Patient Data to generate from:
Name: ${patient.demographics?.name}, Age: ${patient.demographics?.age}, Sex: ${patient.demographics?.sex}, Bed: ${patient.demographics?.bedNumber}
Diagnosis: ${patient.diagnosis} ${patient.classification ? `(${patient.classification})` : ""} ${patient.fractureType || ""}
Surgery Performed: ${patient.surgicalProcedure || "Conservative Management / Not applicable"}
Course in Hospital: ${patient.hospitalCourse || patient.soapNote || "Clinically stable."}
Comorbidities: ${patient.comorbidities?.join(", ") || "None"}

Please structure the markdown response exactly like this:
## 🏥 Clinical Summary
(Brief summary of admission, procedure, and hospital course)

## 💊 Medications List
(Provide a comprehensive Markdown Table with columns: Type/Form (e.g., Tab, Syrup, Ointment, IV), Drug Name, Quantity, Unit/Dose, Route, Frequency, and Duration (Days). Ensure standard orthopaedic pain and antibiotic protocols are included based on the surgical procedure)

## 🩹 Wound Care & Suture Removal
(Clear rules on dressing changes, bathing, and specific date/time/day estimation for suture/staple removal based on surgery date)

## 🚶‍♂️ Patient Advice & Mobilization
(Weight-bearing status, physiotherapy, and daily activities)

## 🚨 Danger Signs (When to return immediately)
(E.g., fever, excessive bleeding, severe calf pain)

## 📅 Follow-Up Plan
(Date, time, day, clinic, and required investigations like X-ray prior to visit)`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the G-MED 3.0 Clinical Summarization Engine. Turn raw patient data into polished, precise discharge papers that are equally optimized for doctors, nurses, pharmacists, and the patient themselves.",
      },
    });

    res.json({ text: response.text || "" });
  } catch (error) {
    console.error("Discharge summary generation failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// --- VITE MIDDLEWARE SETUP ---

(async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();
