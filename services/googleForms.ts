/**
 * Google Forms and Drive integration service for G-MED 3.0.
 * Implements client-side Workspace API calls for Orthopedic residents.
 */

export interface GoogleFormMetadata {
  id: string;
  name: string;
  webViewLink?: string;
  createdTime?: string;
}

export interface GoogleFormQuestion {
  id: string;
  title: string;
  type: string;
}

export interface GoogleFormDetails {
  formId: string;
  title: string;
  description?: string;
  responderUri?: string;
  questions: GoogleFormQuestion[];
}

export interface GoogleFormResponseAnswer {
  questionId: string;
  questionTitle: string;
  value: string;
}

export interface GoogleFormSubmission {
  responseId: string;
  submittedAt: string;
  answers: Record<string, GoogleFormResponseAnswer>; // Map of questionId -> answer details
}

/**
 * Lists the user's Google Forms from Google Drive.
 */
export async function listDriveForms(accessToken: string): Promise<GoogleFormMetadata[]> {
  try {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.form' and trashed=false&pageSize=30&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list forms from Google Drive: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      webViewLink: file.webViewLink,
      createdTime: file.createdTime,
    }));
  } catch (error) {
    console.error("Error listing Drive forms:", error);
    throw error;
  }
}

/**
 * Creates a template Google Form and configures its questions.
 */
export async function createTemplateForm(
  accessToken: string,
  templateType: "intake" | "surgery" | "knee_assessment"
): Promise<GoogleFormDetails> {
  try {
    let title = "G-MED: Patient Intake & Triage Form";
    let description = "Pre-admission orthopedic triage & intake. To be filled by patients or admitting residents.";
    let items: any[] = [];

    if (templateType === "intake") {
      items = [
        {
          title: "Full Patient Name",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        {
          title: "Age",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        {
          title: "Sex",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "RADIO",
                options: [{ value: "Male" }, { value: "Female" }, { value: "Other" }],
              },
            },
          },
        },
        {
          title: "Bed Number",
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: false },
            },
          },
        },
        {
          title: "Primary Orthopedic Complaint & Injury Mechanism",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: true },
            },
          },
        },
        {
          title: "Co-morbidities & Past Medical History",
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: true },
            },
          },
        },
      ];
    } else if (templateType === "surgery") {
      title = "G-MED: Resident Surgical Case Log";
      description = "Orthopedic surgical register and log. Fill in case, procedure, implants and timings.";
      items = [
        {
          title: "Patient Name or Hospital ID",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        {
          title: "Primary Orthopedic Diagnosis",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        {
          title: "Surgical Procedure Performed",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        {
          title: "Implants and Lot Numbers Used",
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: true },
            },
          },
        },
        {
          title: "Tourniquet Time (Minutes)",
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: false },
            },
          },
        },
        {
          title: "Distal Neurovascular Status Post-Op",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "RADIO",
                options: [
                  { value: "Intact - Distal Pulses +, Sensation Intact" },
                  { value: "Deficit - Alert attending immediately" },
                ],
              },
            },
          },
        },
        {
          title: "Intra-operative Notes / Complications",
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: true },
            },
          },
        },
      ];
    } else if (templateType === "knee_assessment") {
      title = "G-MED: Knee Joint Recovery Assessment";
      description = "Patient-reported knee performance scoring. Helps monitor postoperative rehabilitation.";
      items = [
        {
          title: "Patient Name / Case ID",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        {
          title: "How severe is your knee pain during daily walking?",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "RADIO",
                options: [
                  { value: "0 - None" },
                  { value: "1 - Mild" },
                  { value: "2 - Moderate" },
                  { value: "3 - Severe" },
                  { value: "4 - Extreme" },
                ],
              },
            },
          },
        },
        {
          title: "Do you experience knee joint swelling or stiffness in the morning?",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "RADIO",
                options: [
                  { value: "No swelling or stiffness" },
                  { value: "Mild stiffness" },
                  { value: "Moderate swelling/stiffness" },
                  { value: "Severe swelling/stiffness" },
                ],
              },
            },
          },
        },
        {
          title: "Estimated Active Flexion Range (Degrees)",
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: false },
            },
          },
        },
        {
          title: "Patient mobility and rehab milestone notes",
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: true },
            },
          },
        },
      ];
    }

    // 1. Create the base form
    const createResponse = await fetch("https://forms.googleapis.com/v1/forms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        info: {
          title: title,
          documentTitle: title,
        },
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create base form: ${createResponse.statusText}`);
    }

    const newForm = await createResponse.json();
    const formId = newForm.formId;

    // 2. Add description and the form items using batchUpdate
    const requests = [
      // Update form description first
      {
        updateFormInfo: {
          info: {
            description: description,
          },
          updateMask: "description",
        },
      },
      // Create questions
      ...items.map((item, index) => ({
        createItem: {
          item: item,
          location: {
            index: index,
          },
        },
      })),
    ];

    const batchUpdateResponse = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    });

    if (!batchUpdateResponse.ok) {
      throw new Error(`Failed to populate form items: ${batchUpdateResponse.statusText}`);
    }

    // 3. Retrieve the final completed form details
    return await getFormDetails(accessToken, formId);
  } catch (error) {
    console.error("Error creating template form:", error);
    throw error;
  }
}

/**
 * Retrieves the structure of a specific Google Form.
 */
export async function getFormDetails(accessToken: string, formId: string): Promise<GoogleFormDetails> {
  try {
    const response = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve form details: ${response.statusText}`);
    }

    const data = await response.json();
    const questions: GoogleFormQuestion[] = [];

    if (data.items) {
      data.items.forEach((item: any) => {
        if (item.questionItem && item.questionItem.question) {
          questions.push({
            id: item.questionItem.question.questionId,
            title: item.title || "Untitled Question",
            type: item.questionItem.question.choiceQuestion ? "choice" : "text",
          });
        }
      });
    }

    return {
      formId: data.formId,
      title: data.info?.title || "Untitled Google Form",
      description: data.info?.description,
      responderUri: data.responderUri,
      questions,
    };
  } catch (error) {
    console.error(`Error fetching form ${formId}:`, error);
    throw error;
  }
}

/**
 * Retrieves all user responses/submissions for a given Google Form and translates them.
 */
export async function getFormResponses(
  accessToken: string,
  formDetails: GoogleFormDetails
): Promise<GoogleFormSubmission[]> {
  try {
    const response = await fetch(`https://forms.googleapis.com/v1/forms/${formDetails.formId}/responses`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // It's possible that a newly created form has no responses yet and might return 200 with an empty object
      // or return a specific error depending on permissions or state.
      if (response.status === 404 || response.status === 204) {
        return [];
      }
      throw new Error(`Failed to retrieve form responses: ${response.statusText}`);
    }

    const data = await response.json();
    const googleResponses = data.responses || [];

    // Map questions for quick lookup
    const questionMap = new Map<string, string>();
    formDetails.questions.forEach((q) => {
      questionMap.set(q.id, q.title);
    });

    return googleResponses.map((res: any): GoogleFormSubmission => {
      const answers: Record<string, GoogleFormResponseAnswer> = {};

      if (res.answers) {
        Object.keys(res.answers).forEach((qId) => {
          const answerObj = res.answers[qId];
          const textAnswersList = answerObj.textAnswers?.answers || [];
          const combinedValue = textAnswersList.map((ans: any) => ans.value).join(", ");
          const title = questionMap.get(qId) || "Unknown Question";

          answers[qId] = {
            questionId: qId,
            questionTitle: title,
            value: combinedValue,
          };
        });
      }

      return {
        responseId: res.responseId,
        submittedAt: res.lastSubmittedTime || res.createTime || "",
        answers,
      };
    });
  } catch (error) {
    console.error(`Error fetching responses for form ${formDetails.formId}:`, error);
    // If the error indicates there are no responses yet, return an empty list gracefully
    return [];
  }
}
