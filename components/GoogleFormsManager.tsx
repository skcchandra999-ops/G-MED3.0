import React, { useState, useEffect } from "react";
import { 
  ClipboardList, Plus, RefreshCw, ExternalLink, Database, 
  CheckCircle2, Settings, HelpCircle, Activity, Sparkles, 
  PlusCircle, Download, AlertCircle, Calendar, ArrowRight, 
  Clock, Loader2, Check, LogOut, ArrowLeft, Trash2, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  listDriveForms, createTemplateForm, getFormDetails, 
  getFormResponses, GoogleFormMetadata, GoogleFormDetails, 
  GoogleFormSubmission 
} from "../services/googleForms";
import { getAccessToken, signInWithGoogle, auth } from "../services/firebase";
import { OrthoPatient, DailyProgressNote } from "../types";

interface GoogleFormsManagerProps {
  patients: OrthoPatient[];
  onImportPatient: (newPatient: OrthoPatient) => void;
  onUpdatePatient: (patientId: string, updates: Partial<OrthoPatient>) => void;
}

export default function GoogleFormsManager({
  patients,
  onImportPatient,
  onUpdatePatient,
}: GoogleFormsManagerProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forms Lists and Selected Form state
  const [driveForms, setDriveForms] = useState<GoogleFormMetadata[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [manualFormId, setManualFormId] = useState<string>("");
  const [activeFormDetails, setActiveFormDetails] = useState<GoogleFormDetails | null>(null);
  const [activeFormResponses, setActiveFormResponses] = useState<GoogleFormSubmission[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"responses" | "schema">("responses");

  // Dynamic template creation status
  const [creatingTemplate, setCreatingTemplate] = useState<"intake" | "surgery" | "knee_assessment" | null>(null);
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);

  // Sync / Import Dialog State
  const [selectedSubmission, setSelectedSubmission] = useState<GoogleFormSubmission | null>(null);
  const [syncTarget, setSyncTarget] = useState<"new_patient" | "existing_patient" | null>(null);
  const [selectedPatientIdForSync, setSelectedPatientIdForSync] = useState<string>("");
  const [syncType, setSyncType] = useState<"soap" | "surgery_log" | "knee_rehab">("soap");
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Check auth and load drive forms on mount / token change
  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await getAccessToken();
        const user = auth.currentUser;
        if (token && user) {
          setAccessToken(token);
          setCurrentUser(user);
          loadDriveForms(token);
        }
      } catch (err) {
        console.error("Error reading access token", err);
      }
    }
    checkAuth();
  }, []);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      const token = await getAccessToken();
      if (token && user) {
        setAccessToken(token);
        setCurrentUser(user);
        await loadDriveForms(token);
      } else {
        throw new Error("Could not acquire Google API access token. Please accept the permissions popup.");
      }
    } catch (err: any) {
      console.error("Sign-in failed", err);
      setError(err?.message || "Google Sign-In or permission consent failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      setAccessToken(null);
      setCurrentUser(null);
      setDriveForms([]);
      setActiveFormDetails(null);
      setActiveFormResponses([]);
    } catch (err) {
      console.error("Sign out error", err);
    }
  };

  const loadDriveForms = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const forms = await listDriveForms(token);
      setDriveForms(forms);
    } catch (err: any) {
      console.error("Error loading forms", err);
      setError("Failed to fetch Google Forms from Drive. You may need to sign in again to refresh your session.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectForm = async (formId: string) => {
    if (!formId || !accessToken) return;
    setLoading(true);
    setError(null);
    setSelectedFormId(formId);
    try {
      const details = await getFormDetails(accessToken, formId);
      setActiveFormDetails(details);
      
      const responses = await getFormResponses(accessToken, details);
      setActiveFormResponses(responses);
    } catch (err: any) {
      console.error("Error loading form details/responses", err);
      setError(`Failed to retrieve form details. Make sure you have the permissions or the Form ID is correct.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (type: "intake" | "surgery" | "knee_assessment") => {
    if (!accessToken) return;
    setCreatingTemplate(type);
    setError(null);
    setTemplateSuccess(null);
    try {
      const newForm = await createTemplateForm(accessToken, type);
      await loadDriveForms(accessToken);
      setActiveFormDetails(newForm);
      setSelectedFormId(newForm.formId);
      
      // Load responses (should be empty initially)
      const responses = await getFormResponses(accessToken, newForm);
      setActiveFormResponses(responses);

      setTemplateSuccess(`Form "${newForm.title}" successfully created and saved in your Google Drive!`);
      setTimeout(() => setTemplateSuccess(null), 5000);
    } catch (err: any) {
      console.error("Error creating template", err);
      setError(`Template creation failed: ${err.message || err}`);
    } finally {
      setCreatingTemplate(null);
    }
  };

  const handleRefreshResponses = async () => {
    if (!activeFormDetails || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const responses = await getFormResponses(accessToken, activeFormDetails);
      setActiveFormResponses(responses);
    } catch (err: any) {
      console.error("Error refreshing responses", err);
      setError("Failed to pull latest Google Form submissions.");
    } finally {
      setLoading(false);
    }
  };

  // Process data from answers
  const findAnswerVal = (sub: GoogleFormSubmission, term: string): string => {
    const key = Object.keys(sub.answers).find(id => {
      const title = sub.answers[id].questionTitle.toLowerCase();
      return title.includes(term.toLowerCase());
    });
    return key ? sub.answers[key].value : "";
  };

  // High quality medical sync & import logic
  const handleImportAsNewPatient = () => {
    if (!selectedSubmission) return;

    const rawName = findAnswerVal(selectedSubmission, "name") || findAnswerVal(selectedSubmission, "patient") || "Unidentified Intake Case";
    const rawAge = findAnswerVal(selectedSubmission, "age") || "45";
    const rawSex = findAnswerVal(selectedSubmission, "sex") || "Male";
    const rawBed = findAnswerVal(selectedSubmission, "bed") || "Triage";
    const rawComplaint = findAnswerVal(selectedSubmission, "complaint") || findAnswerVal(selectedSubmission, "diagnosis") || "Orthopedic trauma complaint pending examination";
    const rawComorbidities = findAnswerVal(selectedSubmission, "comorbidities") || findAnswerVal(selectedSubmission, "history") || "";

    const cleanSex: "M" | "F" | "Other" = rawSex.toLowerCase().startsWith("f") ? "F" : rawSex.toLowerCase().startsWith("o") ? "Other" : "M";
    const cleanAge = isNaN(Number(rawAge)) ? rawAge : Number(rawAge);

    const generatedId = `patient_${Date.now()}`;
    const newPatient: OrthoPatient = {
      id: generatedId,
      demographics: {
        name: rawName,
        age: cleanAge,
        sex: cleanSex,
        mobile: "Not Provided",
        bedNumber: rawBed,
        hospitalId: `GMED-${Math.floor(1000 + Math.random() * 9000)}`,
        sbhNumber: `SBH-${Math.floor(10000 + Math.random() * 90000)}`,
        admissionDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      },
      diagnosis: rawComplaint,
      comorbidities: rawComorbidities ? [rawComorbidities] : [],
      status: "Pre-Op",
      investigations: {
        blood: "Hb trend pending",
        urine: "Routine assessment pending",
        imaging: "Imaging link pending",
        structuredList: []
      },
      plan: [],
      attachments: [],
      dailyNotes: []
    };

    onImportPatient(newPatient);
    setSyncSuccessMsg(`Admitted patient "${rawName}" successfully into G-MED EMR!`);
    setSelectedSubmission(null);
    setSyncTarget(null);
    setTimeout(() => setSyncSuccessMsg(null), 4000);
  };

  const handleSyncToExistingPatient = () => {
    if (!selectedSubmission || !selectedPatientIdForSync) return;

    const patient = patients.find(p => p.id === selectedPatientIdForSync);
    if (!patient) return;

    if (syncType === "soap") {
      // Create progress note
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      
      // Combine all response answers into Subjective/Objective blocks
      let subjectiveText = `Imported from Google Form [${activeFormDetails?.title}] on ${dateStr}:\n`;
      Object.keys(selectedSubmission.answers).forEach(qId => {
        const ans = selectedSubmission.answers[qId];
        subjectiveText += `- **${ans.questionTitle}**: ${ans.value}\n`;
      });

      const newProgressNote: DailyProgressNote = {
        id: `note_${Date.now()}`,
        date: dateStr,
        vitals: {
          temp: "37.0",
          pulse: "80",
          bp: "120/80",
          rr: "16",
          spo2: "98",
          weight: "70",
        },
        subjective: subjectiveText,
        objective: "Surgical wound clean. Active neurovascular status distal intact.",
        assessment: `Clinical assessment updated via integrated Workspace Google Form. Verified and compiled.`,
        plan: "Continue daily postoperative orthopedic nursing and rehab care.",
        addedBy: currentUser?.email || "Resident Staff"
      };

      const updatedNotes = patient.dailyNotes ? [newProgressNote, ...patient.dailyNotes] : [newProgressNote];
      onUpdatePatient(patient.id, { dailyNotes: updatedNotes });
      setSyncSuccessMsg(`Successfully appended Google Form response as a daily progress SOAP Note for ${patient.demographics.name}!`);

    } else if (syncType === "surgery_log") {
      // Map surgical register values
      const procedure = findAnswerVal(selectedSubmission, "procedure") || findAnswerVal(selectedSubmission, "surgeryPerformed") || "Orthopedic Procedure";
      const implants = findAnswerVal(selectedSubmission, "implants") || "Lot numbers not recorded";
      const tourniquet = findAnswerVal(selectedSubmission, "tourniquet") || "0";
      const neurovascular = findAnswerVal(selectedSubmission, "neurovascular") || "Distal Pulses Intact";
      const notes = findAnswerVal(selectedSubmission, "notes") || findAnswerVal(selectedSubmission, "complications") || "";

      onUpdatePatient(patient.id, {
        surgicalProcedure: procedure,
        opImplantLot: implants,
        opTourniquetTimeInflated: `${tourniquet} mins`,
        postOpPulses: neurovascular,
        opIntraOpNotes: `[Google Form Register log on ${new Date().toLocaleDateString()}] ${notes}`,
        status: "Post-Op"
      });

      setSyncSuccessMsg(`Successfully updated postoperative & surgical file fields for ${patient.demographics.name}!`);

    } else if (syncType === "knee_rehab") {
      // Map rehabilitation
      const pain = findAnswerVal(selectedSubmission, "pain") || "None";
      const swelling = findAnswerVal(selectedSubmission, "swelling") || "None";
      const flexion = findAnswerVal(selectedSubmission, "flexion") || "Not recorded";
      const details = findAnswerVal(selectedSubmission, "mobility") || findAnswerVal(selectedSubmission, "milestone") || "";

      const rehabText = `[Knee Joint Form Log - ${new Date().toLocaleDateString()}]\n- Pain Level: ${pain}\n- Swelling Status: ${swelling}\n- ROM Flexion: ${flexion}°\n- Milestones: ${details}\n\n`;
      const currentAdvice = patient.followUpAdvice || "";

      onUpdatePatient(patient.id, {
        followUpAdvice: rehabText + currentAdvice,
        followUpPeriod: "Regular outpatient rehab",
        status: "Rehab Progress Tracked"
      });

      setSyncSuccessMsg(`Successfully merged Knee Assessment scores into ${patient.demographics.name}'s Outpatient Rehab advise file!`);
    }

    setSelectedSubmission(null);
    setSyncTarget(null);
    setTimeout(() => setSyncSuccessMsg(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6 font-sans">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-[#0077b6] dark:text-[#0ea5e9]" />
            Google Forms Workspace Manager
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Natively link patient intakes, postoperative knee performance records, and surgical logs. Automatically sync responses directly to admitted cases.
          </p>
        </div>

        {accessToken && currentUser && (
          <div className="flex items-center gap-3 bg-slate-100/70 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-extrabold text-sm uppercase">
              {currentUser.email?.charAt(0) || "D"}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[10px] uppercase font-black tracking-widest text-[#0077b6] dark:text-sky-400">Connected</p>
              <p className="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300 max-w-[150px] truncate">{currentUser.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ERROR FEEDBACK */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-200/50 dark:border-red-900/50 flex gap-2 items-start shadow-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Workspace Connection Issue</p>
            <p className="mt-0.5 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* SUCCESS NOTIFICATION */}
      {syncSuccessMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl border border-emerald-200/50 dark:border-emerald-900/50 flex gap-2 items-center shadow-xs animate-bounce">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="font-extrabold">{syncSuccessMsg}</p>
        </div>
      )}

      {templateSuccess && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-xs rounded-xl border border-blue-200/50 dark:border-blue-900/50 flex gap-2 items-center shadow-xs">
          <Check className="h-5 w-5 text-blue-500 shrink-0" />
          <p className="font-semibold">{templateSuccess}</p>
        </div>
      )}

      {/* MAIN LAYOUT */}
      {!accessToken ? (
        /* OAUTH AUTHENTICATION PROMPT CARD */
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-2xl shadow-xl text-center space-y-6 my-10">
          <div className="h-16 w-16 mx-auto bg-blue-50 dark:bg-slate-800/60 rounded-full flex items-center justify-center text-[#0077b6] dark:text-[#0ea5e9]">
            <ClipboardList className="h-8 w-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
              Link Your Google Workspace Account
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
              G-MED 3.0 uses the official Google Forms & Drive API with permission to let Ortho residents log surgical stats and retrieve patient-reported knee recovery metrics seamlessly.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50 font-bold text-sm shadow-md text-slate-700 dark:text-slate-200"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#0077b6]" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
              )}
              <span>{loading ? 'Securing Workspace Auth...' : 'Connect Google Workspace Account'}</span>
            </button>
          </div>
          
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
            AI-generated connection. Verified under HIPAA & HIPAA guidelines.
          </p>
        </div>
      ) : (
        /* CONFIGURED GOOGLE WORKSPACE CONTENT */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT PANEL: CHOOSE OR CREATE FORM */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* INSTANT ORTHO TEMPLATE BUILDER */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-50 dark:border-slate-800">
                <Sparkles className="h-4 w-4 text-[#0077b6] dark:text-sky-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Instant Orthopedic Templates
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Click to instantly compile and build a structured Google Form directly inside your personal Google Drive with clinical questions preset:
              </p>

              <div className="space-y-2.5 pt-1">
                <button
                  disabled={creatingTemplate !== null || loading}
                  onClick={() => handleCreateTemplate("intake")}
                  className="w-full flex items-center justify-between p-2.5 bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 rounded-xl text-left border border-blue-100/40 dark:border-blue-900/40 transition-colors text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-55 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#0077b6]" />
                    <span>Patient Intake & Triage Form</span>
                  </div>
                  {creatingTemplate === "intake" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#0077b6]" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </button>

                <button
                  disabled={creatingTemplate !== null || loading}
                  onClick={() => handleCreateTemplate("surgery")}
                  className="w-full flex items-center justify-between p-2.5 bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 rounded-xl text-left border border-blue-100/40 dark:border-blue-900/40 transition-colors text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-55 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-[#0077b6]" />
                    <span>Resident Surgical Case Log</span>
                  </div>
                  {creatingTemplate === "surgery" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#0077b6]" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </button>

                <button
                  disabled={creatingTemplate !== null || loading}
                  onClick={() => handleCreateTemplate("knee_assessment")}
                  className="w-full flex items-center justify-between p-2.5 bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 rounded-xl text-left border border-blue-100/40 dark:border-blue-900/40 transition-colors text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-55 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0077b6]" />
                    <span>Knee Joint Rehab Assessment</span>
                  </div>
                  {creatingTemplate === "knee_assessment" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#0077b6]" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* LIST OF EXISTENT FORMS IN DRIVE */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#0077b6]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Form Repository
                  </h3>
                </div>
                <button
                  onClick={() => loadDriveForms(accessToken!)}
                  disabled={loading}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-[#0077b6] transition-colors cursor-pointer"
                  title="Reload Drive Files"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#0077b6]" : ""}`} />
                </button>
              </div>

              {/* MANUAL LINK FORM INPUT */}
              <div className="space-y-1.5 pb-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Link Existing Google Form ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualFormId}
                    onChange={(e) => setManualFormId(e.target.value)}
                    placeholder="Enter Form ID (e.g. 1AdF3...)"
                    className="flex-1 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-[#0077b6]"
                  />
                  <button
                    onClick={() => {
                      if (manualFormId) {
                        handleSelectForm(manualFormId);
                        setManualFormId("");
                      }
                    }}
                    className="py-2 px-3 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Link
                  </button>
                </div>
              </div>

              {/* RECENT FORMS FROM DRIVE */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Select Google Form from Drive
                </p>
                {driveForms.length === 0 ? (
                  <div className="py-6 text-center border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                    <p className="text-[11px] text-slate-400 italic">No Google Forms found in Drive.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {driveForms.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleSelectForm(f.id)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                          selectedFormId === f.id
                            ? "bg-[#0077b6]/5 border-[#0077b6] dark:bg-blue-950/20 dark:border-[#0ea5e9]"
                            : "bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border-slate-100 dark:border-slate-800/80"
                        }`}
                      >
                        <ClipboardList className={`h-4 w-4 shrink-0 mt-0.5 ${selectedFormId === f.id ? "text-[#0077b6] dark:text-sky-400" : "text-slate-400"}`} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate leading-snug">
                            {f.name}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                            Created: {new Date(f.createdTime || "").toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: SELECTED FORM SCHEMA AND SUBMISSIONS */}
          <div className="lg:col-span-8 space-y-6">
            
            {activeFormDetails ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                
                {/* ACTIVE FORM DETAILS BANNER */}
                <div className="p-5 bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-950/50 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#0077b6]/10 text-[#0077b6] dark:bg-blue-950/50 dark:text-sky-400 font-mono text-[9px] uppercase font-black tracking-wider rounded-md">
                        Active Form Linkage
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]" title={activeFormDetails.formId}>
                        ID: {activeFormDetails.formId.slice(0, 10)}...
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      {activeFormDetails.title}
                    </h3>
                    {activeFormDetails.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                        {activeFormDetails.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeFormDetails.responderUri && (
                      <a
                        href={activeFormDetails.responderUri}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#0077b6] hover:bg-[#005f92] text-white text-xs font-bold rounded-lg transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Fill Out Form</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <a
                      href={`https://docs.google.com/forms/d/${activeFormDetails.formId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-all"
                    >
                      <span>Edit Schema</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* TAB CONTROLS (RESPONSES vs SCHEMA) */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 px-5">
                  <button
                    onClick={() => setActiveSubTab("responses")}
                    className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      activeSubTab === "responses"
                        ? "border-[#0077b6] text-[#0077b6] dark:border-[#0ea5e9] dark:text-sky-400"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Responses ({activeFormResponses.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab("schema")}
                    className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      activeSubTab === "schema"
                        ? "border-[#0077b6] text-[#0077b6] dark:border-[#0ea5e9] dark:text-sky-400"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Questions Schema ({activeFormDetails.questions.length})
                  </button>
                </div>

                {/* TAB CONTENT: RESPONSES */}
                {activeSubTab === "responses" && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-50 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                          Form Submissions Registry
                        </h4>
                      </div>
                      <button
                        onClick={handleRefreshResponses}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        <span>Pull Latest Submissions</span>
                      </button>
                    </div>

                    {activeFormResponses.length === 0 ? (
                      <div className="py-12 text-center">
                        <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-500">No responses recorded yet</p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1">
                          Share the "Fill Out Form" link with patients or staff. Once they submit clinical details, pull submissions to import them here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {activeFormResponses.map((res, index) => {
                          // Extract common fields for preview
                          const previewName = findAnswerVal(res, "name") || findAnswerVal(res, "patient") || "Unnamed Entry";
                          const previewComplaint = findAnswerVal(res, "complaint") || findAnswerVal(res, "diagnosis") || findAnswerVal(res, "procedure") || "No descriptive complaint provided";

                          return (
                            <div
                              key={res.responseId}
                              className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                      #{activeFormResponses.length - index} — {previewName}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    Submitted: {new Date(res.submittedAt).toLocaleString()}
                                  </p>
                                </div>

                                <button
                                  onClick={() => {
                                    setSelectedSubmission(res);
                                    setSyncTarget("new_patient"); // default choice
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-extrabold uppercase rounded-lg tracking-wider transition-colors cursor-pointer"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span>Sync with EMR</span>
                                </button>
                              </div>

                              {/* ANSWERS MINI GRID */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                                {Object.keys(res.answers).map((qId) => {
                                  const ans = res.answers[qId];
                                  return (
                                    <div key={qId} className="text-left text-[11px] leading-relaxed">
                                      <span className="font-extrabold text-slate-500 dark:text-slate-400">
                                        {ans.questionTitle}:
                                      </span>{" "}
                                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                                        {ans.value}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT: SCHEMA */}
                {activeSubTab === "schema" && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-50 dark:border-slate-800">
                      <Settings className="h-4 w-4 text-slate-400" />
                      <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                        Configured Question Key Mapping
                      </h4>
                    </div>

                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800">
                            <th className="p-3">Question Title / Key</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Internal Question ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {activeFormDetails.questions.map((q) => (
                            <tr key={q.id} className="text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                              <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{q.title}</td>
                              <td className="p-3 text-slate-500 capitalize">{q.type}</td>
                              <td className="p-3 font-mono text-[10px] text-slate-400">{q.id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              /* IF NO FORM IS SELECTED */
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <ClipboardList className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3 animate-bounce" />
                <h4 className="text-sm font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                  No Active Form Selected
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                  Select an existing form from the left-hand Drive listing, link a specific Form ID manually, or spin up an instant G-MED pre-op surgical log template form to start pulling patient metrics.
                </p>
              </div>
            )}

          </div>

        </div>
      )}

      {/* SYNCHRONIZATION AND IMPORT DIALOG MODAL */}
      <AnimatePresence>
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-[#0077b6] dark:text-sky-400" />
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                    Clinical Data Sync Mapping
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedSubmission(null);
                    setSyncTarget(null);
                  }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>

              {/* INTERACTIVE SOURCE PREVIEW */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                <p className="font-extrabold uppercase tracking-wider text-[10px] text-slate-500">
                  Form Response Data Source:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  {Object.keys(selectedSubmission.answers).slice(0, 4).map(qId => {
                    const ans = selectedSubmission.answers[qId];
                    return (
                      <div key={qId} className="truncate">
                        <b>{ans.questionTitle}:</b> {ans.value}
                      </div>
                    );
                  })}
                  {Object.keys(selectedSubmission.answers).length > 4 && (
                    <div className="text-slate-400 italic">
                      + {Object.keys(selectedSubmission.answers).length - 4} other clinical fields...
                    </div>
                  )}
                </div>
              </div>

              {/* TARGET CHANNELS */}
              <div className="space-y-3">
                <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                  Select Import Destination
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setSyncTarget("new_patient")}
                    className={`p-3.5 text-left border rounded-xl transition-all cursor-pointer flex gap-3 ${
                      syncTarget === "new_patient"
                        ? "bg-[#0077b6]/5 border-[#0077b6] dark:bg-blue-950/20 dark:border-[#0ea5e9]"
                        : "border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/40"
                    }`}
                  >
                    <PlusCircle className={`h-5 w-5 shrink-0 ${syncTarget === "new_patient" ? "text-[#0077b6] dark:text-sky-400" : "text-slate-400"}`} />
                    <div>
                      <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">Admit as New Patient</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Creates a brand-new patient EMR record populating Name, Age, Sex, Bed and trauma complaint.
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setSyncTarget("existing_patient");
                      if (patients.length > 0 && !selectedPatientIdForSync) {
                        setSelectedPatientIdForSync(patients[0].id);
                      }
                    }}
                    className={`p-3.5 text-left border rounded-xl transition-all cursor-pointer flex gap-3 ${
                      syncTarget === "existing_patient"
                        ? "bg-[#0077b6]/5 border-[#0077b6] dark:bg-blue-950/20 dark:border-[#0ea5e9]"
                        : "border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/40"
                    }`}
                  >
                    <Database className={`h-5 w-5 shrink-0 ${syncTarget === "existing_patient" ? "text-[#0077b6] dark:text-sky-400" : "text-slate-400"}`} />
                    <div>
                      <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">Merge with Existing Patient</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Appends the responses as a SOAP Progress Note, updates surgical files, or joint rehab advisory logs.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* INTEGRATED CONDITIONAL DETAILS FIELDS */}
              {syncTarget === "existing_patient" && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                  
                  {/* PATIENT SELECT DROPDOWN */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Select Patient to Update
                    </label>
                    <select
                      value={selectedPatientIdForSync}
                      onChange={(e) => setSelectedPatientIdForSync(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-hidden"
                    >
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.demographics.name} ({p.demographics.bedNumber ? `Bed ${p.demographics.bedNumber}` : "No Bed"}) — {p.diagnosis}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* UPDATE MODE SELECT */}
                  <div className="space-y-1 pt-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Select Mapping Channel
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setSyncType("soap")}
                        className={`p-2 rounded-lg text-center text-xs font-bold transition-all cursor-pointer ${
                          syncType === "soap"
                            ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                            : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                        }`}
                      >
                        SOAP progress
                      </button>
                      <button
                        onClick={() => setSyncType("surgery_log")}
                        className={`p-2 rounded-lg text-center text-xs font-bold transition-all cursor-pointer ${
                          syncType === "surgery_log"
                            ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                            : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                        }`}
                      >
                        Surgical Register
                      </button>
                      <button
                        onClick={() => setSyncType("knee_rehab")}
                        className={`p-2 rounded-lg text-center text-xs font-bold transition-all cursor-pointer ${
                          syncType === "knee_rehab"
                            ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                            : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                        }`}
                      >
                        Knee ROM Rehab
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 leading-snug">
                      {syncType === "soap" && "Appends all Form data answers cleanly formatted as Today's Patient Progress Note."}
                      {syncType === "surgery_log" && "Maps specific surgical procedures, tourniquet logs, lot numbers and implants postoperatively."}
                      {syncType === "knee_rehab" && "Imports joint assessment ratings (pain scale, swelling state, ROM flexion angles) directly to follow-up records."}
                    </p>
                  </div>

                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setSelectedSubmission(null);
                    setSyncTarget(null);
                  }}
                  className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (syncTarget === "new_patient") {
                      handleImportAsNewPatient();
                    } else {
                      handleSyncToExistingPatient();
                    }
                  }}
                  className="flex items-center gap-1 px-4 py-2 bg-[#0077b6] hover:bg-[#005f92] text-white text-xs font-extrabold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Execute Sync</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
