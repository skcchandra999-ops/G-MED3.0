import { NewsArticle, DrugInteractionResult, CalculationResult, ClinicalSafetySummaryData, OrthoPatient } from "../types";

// 1. Parse shorthand note
export const parseShorthandToOrthopedicData = async (
  shorthandNote: string,
  existingPatientData?: Partial<OrthoPatient>
): Promise<Partial<OrthoPatient>> => {
  const response = await fetch("/api/gemini/parse-shorthand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shorthandNote, existingPatientData }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to parse shorthand note");
  }
  return response.json();
};

// 2. Fetch medical news
export const fetchMedicalNews = async (): Promise<NewsArticle[]> => {
  try {
    const response = await fetch("/api/gemini/medical-news");
    if (!response.ok) throw new Error("Failed to fetch medical news");
    return response.json();
  } catch (error) {
    console.error("fetchMedicalNews client-side failed:", error);
    return [];
  }
};

// 3. Analyze drug interactions
export const analyzeDrugInteractions = async (
  drugs: { name: string; dosage: string }[]
): Promise<DrugInteractionResult> => {
  if (drugs.length < 2) {
    return {
      interactions: [],
      summary: "Please enter at least two drugs to check for interactions.",
    };
  }
  const response = await fetch("/api/gemini/analyze-interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drugs }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to analyze drug interactions");
  }
  return response.json();
};

// 4. Send clinical message (the streaming helper!)
export const sendClinicalMessage = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string
) => {
  const response = await fetch("/api/gemini/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, message }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to chat with assistant");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body reader");

  const decoder = new TextDecoder();
  let buffer = "";

  const generator = async function* () {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            if (jsonStr.trim()) {
              try {
                yield JSON.parse(jsonStr);
              } catch (e) {
                console.error("Error parsing stream chunk:", e);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  return generator();
};

// 5. Calculate medical math
export const calculateMedicalMath = async (query: string): Promise<CalculationResult> => {
  const response = await fetch("/api/gemini/calculate-math", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to calculate medical math");
  }
  return response.json();
};

// 6. Generate drug safety summary
export const generateDrugSafetySummary = async (
  drugName: string,
  patientWeight: string,
  dose: string,
  route: string
): Promise<ClinicalSafetySummaryData> => {
  const response = await fetch("/api/gemini/safety-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drugName, patientWeight, dose, route }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate safety summary");
  }
  return response.json();
};

// 7. Interpret X-ray Image
export const interpretXrayImage = async (base64Image: string): Promise<string> => {
  const response = await fetch("/api/gemini/interpret-xray", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to interpret X-ray image");
  }
  const result = await response.json();
  return result.text;
};

// 8. Compare X-ray Images
export const compareXrayImages = async (
  base64Image1: string,
  base64Image2: string,
  name1: string,
  name2: string
): Promise<string> => {
  const response = await fetch("/api/gemini/compare-xrays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image1, base64Image2, name1, name2 }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to compare X-ray images");
  }
  const result = await response.json();
  return result.text;
};

// 9. Course of Hospital Stay
export const generateCourseOfHospitalStay = async (patient: OrthoPatient): Promise<string> => {
  const response = await fetch("/api/gemini/course-stay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate course of stay");
  }
  const result = await response.json();
  return result.text;
};

// 10. Discharge Summary
export const generateDischargeSummaryFromAI = async (patient: OrthoPatient): Promise<string> => {
  const response = await fetch("/api/gemini/discharge-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate discharge summary");
  }
  const result = await response.json();
  return result.text;
};
