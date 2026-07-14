import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Users, Search, Plus, Stethoscope, AlertTriangle, FileText, CheckCircle, Clock, Trash2, Send, Loader2, Upload, Paperclip, Eye, Sparkles, Activity, Phone, CreditCard, LayoutDashboard, History, ClipboardList, Bell, Thermometer, Heart, Droplets, ChevronRight, ChevronDown, ChevronUp, Zap, Download, Printer, Save, Scissors, Mic, MicOff, Share2, Copy, Bold, Italic, List, ListOrdered, PlusCircle, AlertCircle, ShieldAlert, CheckSquare, Home, Calendar, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { OrthoPatient, PatientPlanItem, PatientAttachment, OrthoHistory, OrthoPhysicalExam, StructuredInvestigation } from '../types';
import { parseShorthandToOrthopedicData, interpretXrayImage, generateDischargeSummaryFromAI, generateCourseOfHospitalStay, compareXrayImages } from '../services/geminiService';
import { ORTHO_DIAGNOSES, PATIENT_STATUSES, COMORBIDITIES, SMART_SUGGESTIONS, COMMON_LABS, PRE_OP_CHECKLIST, ADMISSION_CHECKLIST, MORNING_PROGRESS_ITEMS, DAILY_WARD_DUTIES, COMMON_PROCEDURES, DANGER_SIGNS, ORTHO_CATEGORIES, ORTHO_CLASSIFICATIONS, SPECIAL_TESTS, MOI_OPTIONS, TIME_OPTIONS } from '../constants';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { marked } from 'marked';
import { motion, AnimatePresence } from 'motion/react';
import ProcedureTimer from './ProcedureTimer';
import ExecutiveBriefingCard from './ExecutiveBriefingCard';

type EMRTab = 'summary' | 'demographics' | 'history_exam' | 'investigations' | 'plan' | 'discharge' | 'daily_progress' | 'hub' | 'diagnosis' | 'pac' | 'consultation' | 'ot_plan' | 'operation' | 'post_op' | 'follow_up';

function DebouncedSOAPNote({ 
    initialValue, 
    onSave,
    patient,
    updatePatient
}: { 
    initialValue: string; 
    onSave: (val: string) => void;
    patient: OrthoPatient;
    updatePatient: (id: string, updates: Partial<OrthoPatient>) => void;
}) {
    const [value, setValue] = useState(initialValue);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setValue(newVal);
        setStatus('saving');
        
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onSave(newVal);
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
            timerRef.current = null;
        }, 800);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <textarea 
                value={value}
                onChange={handleChange}
                placeholder="S: ... O: ... A: ... P: ..."
                className="w-full text-sm text-slate-700 dark:text-slate-300 leading-relaxed p-4 bg-transparent border-none focus:ring-0 min-h-[150px] resize-y font-sans"
            />
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-start gap-2 text-[10px] text-slate-500">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        <span>AI content requires verification.</span>
                    </div>
                    <button 
                        onClick={() => {
                            const adCheck = patient.admissionChecklist?.length ? `Admissions: ${patient.admissionChecklist.join(', ')}.` : '';
                            const preCheck = patient.preOpChecklist?.length ? `Pre-Op: ${patient.preOpChecklist.join(', ')}.` : '';
                            const morningCheck = patient.morningProgress?.length ? `Morn Round: ${patient.morningProgress.join(', ')}.` : '';
                            const classification = patient.classification ? `Class: ${patient.classification} ${patient.fractureType || ''}.` : '';
                            const autoText = `${patient.diagnosis}. ${classification} ${patient.status}. ${adCheck} ${preCheck} ${morningCheck}`.trim();
                            updatePatient(patient.id, { soapNote: (initialValue || '') + (initialValue ? '\n' : '') + autoText });
                        }}
                        className="text-[10px] font-black text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded border border-purple-100"
                    >
                        <Sparkles className="h-3 w-3" /> Sync Checklist Data
                    </button>
                </div>
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 min-w-[70px] justify-end">
                    {status === 'saving' && <><Loader2 className="h-3 w-3 animate-spin"/> Saving...</>}
                    {status === 'saved' && <><CheckCircle className="h-3 w-3 text-emerald-500"/> Saved</>}
                </div>
            </div>
        </div>
    );
}

function DebouncedQuickNotes({
    initialValue,
    onSave,
    currentCategory = 'General',
    onChangeCategory
}: {
    initialValue: string;
    onSave: (val: string) => void;
    currentCategory?: 'Urgent' | 'Routine' | 'General';
    onChangeCategory: (cat: 'Urgent' | 'Routine' | 'General') => void;
}) {
    const [value, setValue] = useState(initialValue);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    // Auto-grow textarea height as content changes
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setValue(newVal);
        setStatus('saving');
        
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onSave(newVal);
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
            timerRef.current = null;
        }, 800);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleFormat = (type: 'bold' | 'italic' | 'bullet' | 'list') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = value;
        const selectedText = text.substring(start, end);

        let replacement = '';
        let newSelectionStart = start;
        let newSelectionEnd = end;

        if (type === 'bold') {
            replacement = `**${selectedText || 'bold text'}**`;
            newSelectionStart = start + 2;
            newSelectionEnd = start + 2 + (selectedText ? selectedText.length : 9);
        } else if (type === 'italic') {
            replacement = `*${selectedText || 'italic text'}*`;
            newSelectionStart = start + 1;
            newSelectionEnd = start + 1 + (selectedText ? selectedText.length : 11);
        } else if (type === 'bullet') {
            const needsNewLine = start > 0 && text.charAt(start - 1) !== '\n';
            const prefix = needsNewLine ? '\n- ' : '- ';
            replacement = `${prefix}${selectedText || 'bullet item'}`;
            newSelectionStart = start + prefix.length;
            newSelectionEnd = start + prefix.length + (selectedText ? selectedText.length : 11);
        } else if (type === 'list') {
            const needsNewLine = start > 0 && text.charAt(start - 1) !== '\n';
            const prefix = needsNewLine ? '\n1. ' : '1. ';
            replacement = `${prefix}${selectedText || 'list item'}`;
            newSelectionStart = start + prefix.length;
            newSelectionEnd = start + prefix.length + (selectedText ? selectedText.length : 9);
        }

        const newValue = text.substring(0, start) + replacement + text.substring(end);
        setValue(newValue);
        
        setStatus('saving');
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onSave(newValue);
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
            timerRef.current = null;
        }, 800);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
        }, 0);
    };

    // Style borders and text based on active category
    const activeBorderClass = 
        currentCategory === 'Urgent' ? 'border-rose-200 dark:border-rose-900/60' :
        currentCategory === 'Routine' ? 'border-amber-200 dark:border-amber-900/60' :
        'border-sky-200 dark:border-sky-900/60';

    return (
        <div className={`bg-white dark:bg-slate-900 border ${activeBorderClass} rounded-xl overflow-hidden shadow-sm transition-all duration-300`}>
            {/* Tag Selector / Small Color Picker */}
            <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Priority Tag
                </span>
                <div className="flex items-center gap-1.5">
                    {(['Urgent', 'Routine', 'General'] as const).map((cat) => {
                        const isActive = currentCategory === cat;
                        let badgeStyle = "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer select-none ";
                        if (isActive) {
                            if (cat === 'Urgent') badgeStyle += "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-450 border-rose-300 dark:border-rose-900/50 shadow-xs font-bold";
                            else if (cat === 'Routine') badgeStyle += "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-450 border-amber-300 dark:border-amber-900/50 shadow-xs font-bold";
                            else badgeStyle += "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-450 border-sky-300 dark:border-sky-900/50 shadow-xs font-bold";
                        } else {
                            badgeStyle += "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-550 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300";
                        }
                        
                        const dotColor = cat === 'Urgent' ? 'bg-rose-500 shadow-rose-500/50 shadow-md animate-pulse' : cat === 'Routine' ? 'bg-amber-500' : 'bg-sky-500';

                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => onChangeCategory(cat)}
                                className={badgeStyle}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                    {cat}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Formatting Toolbar */}
            <div className="px-3.5 py-1.5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/20 dark:bg-slate-950/10 flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => handleFormat('bold')}
                    className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center justify-center cursor-pointer"
                    title="Bold (**text**)"
                >
                    <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => handleFormat('italic')}
                    className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center justify-center cursor-pointer"
                    title="Italic (*text*)"
                >
                    <Italic className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-800 mx-1" />
                <button
                    type="button"
                    onClick={() => handleFormat('bullet')}
                    className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center justify-center cursor-pointer"
                    title="Bullet List (- item)"
                >
                    <List className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => handleFormat('list')}
                    className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center justify-center cursor-pointer"
                    title="Numbered List (1. item)"
                >
                    <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 ml-auto select-none pointer-events-none font-medium">
                    Markdown supported
                </span>
            </div>

            <textarea 
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                placeholder="💡 Jot down brief, temporary reminders, patient quirks, or resident checklists. This is a temporary scratchpad not included in formal templates."
                className="w-full text-xs text-slate-700 dark:text-slate-300 leading-relaxed p-3.5 bg-transparent border-none focus:ring-0 min-h-[120px] resize-none overflow-hidden font-sans placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none"
            />
            <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950 flex items-center justify-between select-none">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    Resident Scratchpad
                </span>
                <div className="flex items-center gap-1.5 matches-quick-notes-actions">
                    {value && (
                        <>
                            <button 
                                type="button"
                                onClick={handleCopy}
                                className="text-[9px] py-0.5 px-1.5 text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 font-bold transition-all hover:bg-sky-50 dark:hover:bg-sky-950/20 rounded cursor-pointer flex items-center gap-1 border border-transparent hover:border-sky-200 dark:hover:border-sky-900/40"
                                title="Copy quick notes to clipboard"
                            >
                                {copied ? (
                                    <>
                                        <CheckCircle className="h-2.5 w-2.5 text-emerald-500 animate-bounce" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-2.5 w-2.5" />
                                        Copy Notes
                                    </>
                                )}
                            </button>
                            <span className="text-slate-200 dark:text-slate-800 dark:text-slate-200 text-[9px] select-none">|</span>
                            <button 
                                type="button"
                                onClick={() => {
                                    if (window.confirm('Clear all temporary reminders on this scratchpad?')) {
                                        setValue('');
                                        onSave('');
                                        setStatus('saved');
                                        setTimeout(() => setStatus('idle'), 2000);
                                    }
                                }}
                                className="text-[9px] py-0.5 px-1.5 text-red-500 hover:text-red-700 font-bold transition-all hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer"
                            >
                                Clear Pad
                            </button>
                        </>
                    )}
                    <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1.5 min-w-[62px] justify-end font-mono">
                        {status === 'saving' && <><Loader2 className="h-2.5 w-2.5 animate-spin"/> Saving...</>}
                        {status === 'saved' && <><CheckCircle className="h-2.5 w-2.5 text-emerald-500"/> Saved</>}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface HemoglobinTrendTrackerProps {
    patient: OrthoPatient;
    onUpdateHistory: (history: { id: string; date: string; hb: number }[]) => void;
}

export function HemoglobinTrendTracker({ patient, onUpdateHistory }: HemoglobinTrendTrackerProps) {
    const [newHbDate, setNewHbDate] = useState('');
    const [newHbVal, setNewHbVal] = useState('');
    const [error, setError] = useState('');

    const hbData = patient.investigations.hbHistory || (
        patient.id === '1' ? [
            { id: 'h1', date: '05/20 (Adm)', hb: 13.8 },
            { id: 'h2', date: '05/21 (Pre-Op)', hb: 13.0 },
            { id: 'h3', date: '05/21 (Post-Op)', hb: 11.2 },
            { id: 'h4', date: '05/22 (POD 1)', hb: 10.5 },
            { id: 'h5', date: '05/22 (POD 2)', hb: 11.2 }
        ] : patient.id === '2' || patient.demographics.name.includes('Sunita') ? [
            { id: 's1', date: '05/19 (Adm)', hb: 12.0 },
            { id: 's2', date: '05/21 (Pre-Op)', hb: 11.5 },
            { id: 's3', date: '05/22 (POD 1)', hb: 9.8 }
        ] : [
            { id: 'g1', date: '05/22 (Adm)', hb: 12.5 }
        ]
    );

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const val = parseFloat(newHbVal);
        if (!newHbDate.trim()) {
            setError('Enter a label (e.g. POD 3)');
            return;
        }
        if (isNaN(val) || val < 1 || val > 25) {
            setError('Enter Hb between 1 and 25 g/dL');
            return;
        }

        const updated = [
            ...hbData,
            { id: Date.now().toString(), date: newHbDate, hb: val }
        ];
        onUpdateHistory(updated);
        setNewHbDate('');
        setNewHbVal('');
    };

    const handleDelete = (id: string) => {
        const updated = hbData.filter(item => item.id !== id);
        onUpdateHistory(updated);
    };

    const width = 500;
    const height = 240;
    const padding = { top: 30, right: 30, bottom: 45, left: 45 };

    const minY = Math.min(6.5, d3.min(hbData, d => d.hb) || 6.5) - 1.5;
    const maxY = Math.max(17.5, d3.max(hbData, d => d.hb) || 17.5) + 1.5;

    const yScale = d3.scaleLinear()
        .domain([minY, maxY])
        .range([height - padding.bottom, padding.top]);

    const getX = (index: number) => {
        if (hbData.length <= 1) {
            return (width - padding.left - padding.right) / 2 + padding.left;
        }
        return padding.left + (index * (width - padding.left - padding.right) / (hbData.length - 1));
    };

    const lineGenerator = d3.line<{ x: number, y: number }>()
        .x(d => d.x)
        .y(d => d.y);

    const points = hbData.map((d, i) => ({
        x: getX(i),
        y: yScale(d.hb),
        hb: d.hb,
        date: d.date,
        id: d.id
    }));

    const pathD = lineGenerator(points) || '';
    const yTicks = d3.ticks(minY, maxY, 6);

    return (
        <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#0077b6]" />
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">Hemoglobin (Hb) Trend Tracker</h4>
                        <p className="text-[10px] text-slate-500 font-medium font-sans">Real-time D3 visualization & monitoring of blood counts</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-mono select-none px-2 py-1 bg-red-105 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-full font-black uppercase border border-red-200 dark:border-red-900/30">
                    <span>Anemia line: 8.0 g/dL</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 relative p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    {hbData.length === 0 ? (
                        <div className="h-[240px] flex flex-col items-center justify-center text-slate-400 font-medium text-xs">
                            <AlertTriangle className="h-8 w-8 text-amber-500 mb-2 opacity-60" />
                            No Hb logs entered yet. Enter some values below.
                        </div>
                    ) : (
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                            {yScale(8) < (height - padding.bottom) && (
                                <rect 
                                    x={padding.left} 
                                    y={yScale(8)} 
                                    width={width - padding.left - padding.right} 
                                    height={(height - padding.bottom) - yScale(8)} 
                                    fill="rgba(239, 68, 68, 0.08)" 
                                />
                            )}
                            {yScale(16) < yScale(12) && (
                                <rect 
                                    x={padding.left} 
                                    y={yScale(16)} 
                                    width={width - padding.left - padding.right} 
                                    height={yScale(12) - yScale(16)} 
                                    fill="rgba(16, 185, 129, 0.03)" 
                                />
                            )}

                            {minY < 8 && maxY > 8 && (
                                <g>
                                    <line 
                                        x1={padding.left} 
                                        x2={width - padding.right} 
                                        y1={yScale(8)} 
                                        y2={yScale(8)} 
                                        stroke="#ef4444" 
                                        strokeDasharray="4 4" 
                                        strokeWidth="1.5" 
                                        opacity="0.85"
                                    />
                                    <text 
                                        x={width - padding.right - 6} 
                                        y={yScale(8) - 4} 
                                        fill="#ef4444" 
                                        fontSize="8" 
                                        fontWeight="900" 
                                        textAnchor="end"
                                        className="uppercase tracking-widest opacity-80"
                                    >
                                        Transfusion Trigger (8.0 g/dL)
                                    </text>
                                </g>
                            )}

                            {yTicks.map(t => (
                                <g key={t} opacity="0.6">
                                    <line 
                                        x1={padding.left} 
                                        x2={width - padding.right} 
                                        y1={yScale(t)} 
                                        y2={yScale(t)} 
                                        stroke="currentColor" 
                                        className="text-slate-200 dark:text-slate-800 dark:text-slate-200" 
                                        strokeWidth="0.5" 
                                    />
                                    <text 
                                        x={padding.left - 8} 
                                        y={yScale(t) + 3} 
                                        fill="currentColor" 
                                        className="text-slate-400 dark:text-slate-500 font-mono text-[9px] font-bold" 
                                        textAnchor="end"
                                    >
                                        {t.toFixed(1)}
                                    </text>
                                </g>
                            ))}

                            {points.map((p, i) => (
                                <g key={p.id}>
                                    <line 
                                        x1={p.x} 
                                        x2={p.x} 
                                        y1={padding.top} 
                                        y2={height - padding.bottom} 
                                        stroke="currentColor" 
                                        className="text-slate-200 dark:text-slate-800 dark:text-slate-200" 
                                        strokeDasharray="2 2" 
                                        strokeWidth="0.5" 
                                    />
                                    <text 
                                        x={p.x} 
                                        y={height - padding.bottom + 16} 
                                        fill="currentColor" 
                                        className="text-slate-500 dark:text-slate-400 font-bold font-sans text-[9px]" 
                                        textAnchor="middle"
                                    >
                                        {p.date}
                                    </text>
                                </g>
                            ))}

                            <line 
                                x1={padding.left} 
                                x2={width - padding.right} 
                                y1={height - padding.bottom} 
                                y2={height - padding.bottom} 
                                stroke="currentColor" 
                                className="text-slate-300 dark:text-slate-700" 
                                strokeWidth="1" 
                            />
                            <line 
                                x1={padding.left} 
                                x2={padding.left} 
                                y1={padding.top} 
                                y2={height - padding.bottom} 
                                stroke="currentColor" 
                                className="text-slate-300 dark:text-slate-700" 
                                strokeWidth="1" 
                            />

                            {points.length > 1 && (
                                <path 
                                    d={pathD} 
                                    fill="none" 
                                    stroke="#0077b6" 
                                    strokeWidth="3" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                />
                            )}

                            {points.map((p, i) => {
                                const isCritical = p.hb < 8.0;
                                const isLow = p.hb < 12.0;
                                let pointColor = "#0077b6";
                                if (isCritical) pointColor = "#ef4444";
                                else if (isLow) pointColor = "#f59e0b";
                                
                                return (
                                    <g key={p.id} className="group">
                                        <circle 
                                            cx={p.x} 
                                            cy={p.y} 
                                            r="5" 
                                            fill={pointColor} 
                                            stroke="#fff" 
                                            strokeWidth="2" 
                                        />
                                        <text 
                                            x={p.x} 
                                            y={p.y - 10} 
                                            fill={isCritical ? "#ef4444" : "currentColor"} 
                                            className="text-slate-900 dark:text-slate-200 font-black font-mono text-[10px]" 
                                            textAnchor="middle"
                                        >
                                            {p.hb.toFixed(1)}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    )}
                </div>

                <div className="space-y-4">
                    <form onSubmit={handleAdd} className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-[#0077b6] tracking-widest block">Log Hb Point</span>
                        <div>
                            <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Time Point / Stage</label>
                            <input 
                                type="text"
                                placeholder="e.g. POD 3"
                                value={newHbDate}
                                onChange={e => setNewHbDate(e.target.value)}
                                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#0077b6] focus:ring-1 focus:ring-[#0077b6] dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Hb Level (g/dL)</label>
                            <input 
                                type="number"
                                step="0.1"
                                placeholder="e.g. 11.5"
                                value={newHbVal}
                                onChange={e => setNewHbVal(e.target.value)}
                                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#0077b6] focus:ring-1 focus:ring-[#0077b6] dark:text-white"
                            />
                        </div>
                        {error && (
                            <div className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded">
                                <AlertTriangle className="h-3 w-3" />
                                {error}
                            </div>
                        )}
                        <button 
                            type="submit"
                            className="w-full py-2 bg-[#0077b6] text-white hover:bg-[#005f92] transition-colors rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                        >
                            <Plus className="h-4 w-4" /> Add Record
                        </button>
                    </form>

                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 no-scrollbar">
                        <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block mb-1">Timeline Points</span>
                        {hbData.map((item, idx) => {
                            const isAbnormal = item.hb < 12.0;
                            const isCritical = item.hb < 8.0;
                            return (
                                <div key={item.id} className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60 rounded-lg text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${isCritical ? 'bg-red-500 animate-pulse' : isAbnormal ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{item.date}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-mono font-black ${isCritical ? 'text-red-600 dark:text-red-400 animate-pulse' : isAbnormal ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {item.hb.toFixed(1)} g/dL
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={() => handleDelete(item.id)}
                                            className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 p-0.5"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

const formatInjuryTimeStr = (timeStr?: string): string => {
    if (!timeStr) return '';
    if (timeStr.startsWith("Custom: ")) {
        return timeStr.replace("Custom: ", "");
    }
    const match = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (match) {
        let hrs = parseInt(match[1], 10);
        const mins = match[2];
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        hrs = hrs % 12;
        hrs = hrs ? hrs : 12;
        return `${String(hrs).padStart(2, '0')}:${mins} ${ampm}`;
    }
    return timeStr;
};

interface BloodResult {
    name: string;
    displayName: string;
    value: number;
    unit: string;
    min: number;
    max: number;
    status: 'low' | 'normal' | 'high';
    rawString: string;
}

const parseBloodReports = (bloodStr: string): BloodResult[] => {
    if (!bloodStr) return [];
    
    const labConfigs = [
        { name: 'Hb', displayName: 'Hemoglobin (Hb)', regex: /(?:hb|hemoglobin|hemo)[:\s\-=]*([0-9]+(?:\.[0-9]+)?)/i, unit: 'g/dL', min: 12.0, max: 17.5 },
        { name: 'WBC', displayName: 'White Blood Cell (WBC)', regex: /(?:wbc|tc|white blood)[:\s\-=]*([0-9]+(?:\.[0-9]+)?)\s*(k)?/i, unit: 'k/µL', min: 4.0, max: 11.0, isKUnit: true },
        { name: 'Platelets', displayName: 'Platelets (PLT)', regex: /(?:platelet|platelets|plt)[:\s\-=]*([0-9]+(?:\.[0-9]+)?)\s*(k)?/i, unit: 'k/µL', min: 150.0, max: 450.0, isKUnit: true },
        { name: 'Creatinine', displayName: 'Serum Creatinine', regex: /(?:creatinine|creat|cr|scr)[:\s\-=]*([0-9]+(?:\.[0-9]+)?)/i, unit: 'mg/dL', min: 0.6, max: 1.2 },
        { name: 'Urea', displayName: 'Blood Urea', regex: /(?:urea|bun)[:\s\-=]*([0-9]+(?:\.[0-9]+)?)/i, unit: 'mg/dL', min: 15.0, max: 45.0 },
        { name: 'Glucose', displayName: 'Blood Glucose', regex: /(?:glucose|rbs|fbs|ppbs)[:\s\-=]*([0-9]+(?:\.[0-9]+)?)/i, unit: 'mg/dL', min: 70.0, max: 140.0 },
        { name: 'Sodium', displayName: 'Serum Sodium (Na+)', regex: /(?:sodium|na\+?)[:\s\-=]*([0-9]+(?:\.[0-9]+)?)/i, unit: 'mEq/L', min: 135.0, max: 145.0 },
        { name: 'Potassium', displayName: 'Serum Potassium (K+)', regex: /(?:potassium|k\+?)[:\s\-=]*([0-9]+(?:\.[0-9]+)?)/i, unit: 'mEq/L', min: 3.5, max: 5.0 }
    ];

    const results: BloodResult[] = [];

    labConfigs.forEach(cfg => {
        const match = bloodStr.match(cfg.regex);
        if (match) {
            let val = parseFloat(match[1]);
            if (isNaN(val)) return;

            // Handle K Unit conversions if entered raw e.g. "12000"
            if (cfg.isKUnit) {
                if (val > 1000) {
                    val = val / 1000;
                }
            }

            let status: 'low' | 'normal' | 'high' = 'normal';
            if (val < cfg.min) status = 'low';
            else if (val > cfg.max) status = 'high';

            results.push({
                name: cfg.name,
                displayName: cfg.displayName,
                value: val,
                unit: cfg.unit,
                min: cfg.min,
                max: cfg.max,
                status,
                rawString: match[0]
            });
        }
    });

    return results;
};

const VitalField = ({
    label,
    value,
    unit,
    onChange,
    type = 'text',
    step,
}: {
    label: string;
    value: any;
    unit: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    step?: string;
}) => {
    const [animateClass, setAnimateClass] = useState('');
    const prevValueRef = useRef(value);

    useEffect(() => {
        if (prevValueRef.current !== undefined && prevValueRef.current !== value) {
            setAnimateClass('animate-vital-flash');
            const timer = setTimeout(() => {
                setAnimateClass('');
            }, 1200);
            prevValueRef.current = value;
            return () => clearTimeout(timer);
        }
        prevValueRef.current = value;
    }, [value]);

    return (
        <div className={`bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 ${animateClass}`}>
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{label}</span>
            <div className="flex items-center gap-2">
                <input 
                    type={type} 
                    step={step}
                    value={value ?? ''} 
                    onChange={onChange}
                    className="w-full text-sm font-black text-slate-900 dark:text-white bg-transparent border-none p-0 focus:ring-0 outline-none"
                />
                <span className="text-[10px] text-slate-400 font-mono font-bold select-none">{unit}</span>
            </div>
        </div>
    );
};

const InitialPatients: OrthoPatient[] = [
    {
        id: '1',
        demographics: {
            name: 'DAL BAHADUR RANA',
            age: 55,
            sex: 'M',
            bedNumber: '3126',
            mobile: '9805810978',
            sbhNumber: 'SBH265477',
            hospitalId: 'HOSP-101',
            rank: 'REG FAM',
            admissionDate: '25/02/2083'
        },
        diagnosis: 'RT CLOSED DISTAL 3RD TIBIA # WITH PROXIMAL 3RD FIBULA # WITH INTACT DNVS WITH DEXTROCARDIA',
        classification: 'AO/OTA Classification',
        fractureType: '42-A1',
        surgicalProcedure: 'CRIF WITH IMIL NAILING',
        comorbidities: ['Dextrocardia (Situs Inversus Check)'],
        status: 'Pre-Op Workup',
        history: {
            chiefComplaint: 'Pain and swelling in Rt lower leg following RTA',
            hpi: '55/M, presented following a slip and fall. No head injury or hematoma. Distal pulses intact. Diagnostics show Dextrocardia.',
            pmh: 'Congenital Dextrocardia',
            psh: 'Nil',
            medications: 'Nil',
            allergies: 'None known',
            socialHistory: 'Non-smoker'
        },
        physicalExam: {
            vitals: { bp: '120/80', pulse: 74, temp: 98.6, rr: 16, spo2: 98, timestamp: '2026-06-13' },
            general: 'Conscious, stable.',
            localExam: {
                inspection: 'Skin intact. Symmetrical alignment. Intact sensation.',
                palpation: 'Tenderness over distal 1/3 right leg. Distal pulses palpable.',
                movements: 'Restricted range of motion.',
                neurovascular: 'Distal neurovascular status intact'
            }
        },
        investigations: {
            blood: 'Hb: 13.5 g/dL, WBC: 7.8k, Plt: 220k. PAC Date: 28/02/2083',
            urine: 'Normal',
            imaging: 'X-ray Leg: Rt closed distal 3rd tibia fracture with proximal 3rd fibula fracture.',
            others: 'Awaiting abdominal pelvic scan for situs inversus'
        },
        plan: [
            { id: 'p1', text: 'DUE USG ABDOMEN PELVICS R/O SITUS INVERSUS', status: 'pending' },
            { id: 'p2', text: 'Undergo CRIF with IMIL Nailing', status: 'pending' }
        ],
        attachments: [],
        soapNote: 'Pre-op evaluation for CRIF with IMIL Nailing. Standard cardiac safety checks in progress due to Dextrocardia.'
    },
    {
        id: '2',
        demographics: {
            name: 'ARJUN. KC',
            age: 32,
            sex: 'M',
            bedNumber: '3129',
            mobile: '98435880087',
            sbhNumber: 'SBH39623',
            hospitalId: 'HOSP-102',
            rank: 'REG ARMY',
            admissionDate: '28/02/2083'
        },
        diagnosis: 'ARTHOFIBROSIS OF RT KNEE WITH BONY BLOCK S/P ORIF WITH BICOLUMNAR PLATING FOR RT PROXIMAL TIBIA #',
        surgicalProcedure: 'ARTHOSCOPIC ARTHOLYSIS',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: {
            chiefComplaint: 'Severe stiffness and limited motion of Rt knee',
            hpi: 'Patient underwent ORIF with bicolumnar plating for proximal tibia fracture. Developed severe stiffness.',
            pmh: 'S/P ORIF Proximal Tibia',
            psh: 'ORIF proximal tibia plating',
            medications: 'Nil',
            allergies: 'None',
            socialHistory: ''
        },
        physicalExam: {
            localExam: {
                inspection: 'Old surgical scars healthy.',
                palpation: 'Bony block felt during flexion. Minimal tenderness.',
                movements: 'Rt knee flexion restricted to 45 deg.',
                neurovascular: 'Intact'
            }
        },
        investigations: {
            blood: 'Hb: 14.5 g/dL, WBC: 8.5k. PAC Date: 26/02/2083',
            urine: 'Normal',
            imaging: 'X-ray Rt knee: Showing hardware in situ, periarticular osteophytes/bony blocks.',
            others: ''
        },
        plan: [
            { id: 'p1', text: 'PAC Accepted', status: 'done' },
            { id: 'p2', text: 'Arthroscopic arthrolysis of right knee', status: 'pending' }
        ],
        attachments: [],
        soapNote: 'Post-traumatic arthrofibrosis. PAC Accepted. Case scheduled for arthroscopic debridement and bony block release.'
    },
    {
        id: '3',
        demographics: {
            name: 'YADAV PURI',
            age: 42,
            sex: 'M',
            bedNumber: '3173',
            mobile: '9862196364',
            sbhNumber: 'SBH227738',
            hospitalId: 'HOSP-103',
            rank: 'REG ARMY',
            admissionDate: '13/02/2083'
        },
        diagnosis: 'RT OPEN (GA-IIIA) MM WITH OPEN (GA-IIIA) 2ND 3RD & 4TH MC # WITH INTACT DNVS',
        surgicalProcedure: 'STSG',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: {
            chiefComplaint: 'Open fractures with soft tissue defect',
            hpi: '42/M presented with open Gustilo-Anderson category IIIA medial malleolus and metacarpal fractures.',
            pmh: 'No active comorbidities',
            psh: '',
            medications: '',
            allergies: '',
            socialHistory: ''
        },
        physicalExam: {
            localExam: {
                inspection: 'Soft tissue defect over RT ankle and hand. Healthy granulation tissue.',
                palpation: 'Intact distal pulses.',
                movements: 'Restricted.',
                neurovascular: 'Distal neurovascular status intact'
            }
        },
        investigations: {
            blood: 'Hb: 12.8, PAC Accepted: 27/02/2083',
            urine: 'Normal',
            imaging: 'X-rays: Medial malleolar fracture and multiple metacarpal fractures.',
            others: ''
        },
        plan: [
            { id: 'p1', text: 'PAC Accepted', status: 'done' },
            { id: 'p2', text: 'Split-Thickness Skin Graft (STSG)', status: 'pending' }
        ],
        attachments: [],
        soapNote: 'Open wounds are clean with healthy granulation bed. PAC Accepted for definitive skin graft cover (STSG).'
    },
    {
        id: '4',
        demographics: {
            name: 'SANJOG KARKI',
            age: 42,
            sex: 'M',
            bedNumber: '3040',
            mobile: '9704337442',
            sbhNumber: 'SBH217586',
            hospitalId: 'HOSP-104',
            rank: 'REG ARMY',
            admissionDate: '26/02/2083'
        },
        diagnosis: 'RECURRENT SHOULDER DISLOCATION',
        surgicalProcedure: 'OPEN LATERGET PROCEDURE WITH HILL-SACHS REMPLISSAGE/REPAIR',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: {
            chiefComplaint: 'Frequent instability & dislocation of Rt shoulder',
            hpi: 'Presented with history of multiple dislocations of right shoulder.',
            pmh: 'Recurrent shoulder dislocation',
            psh: 'Nil',
            medications: '',
            allergies: '',
            socialHistory: ''
        },
        physicalExam: {
            localExam: {
                inspection: 'No muscle wasting.',
                palpation: 'Apprehension test positive, sulcus sign positive.',
                movements: 'ROM hypermobile.',
                neurovascular: 'Intact'
            }
        },
        investigations: {
            blood: 'Hb: 14.1, WBC: 7.2k. PAC Approved: 27/02/2083',
            urine: 'Normal',
            imaging: 'MRI: Hill-Sachs lesion and anterior glenoid bone loss.',
            others: ''
        },
        plan: [
            { id: 'p1', text: 'PAC Accepted', status: 'done' },
            { id: 'p2', text: 'Latarjet procedure and Hill-Sachs remplissage', status: 'pending' }
        ],
        attachments: [],
        soapNote: 'Recurrent shoulder instability with bone loss. PAC Accepted for Open Latarjet.'
    },
    {
        id: '5',
        demographics: {
            name: 'JIT MAN K.C',
            age: 45,
            sex: 'M',
            bedNumber: '3070',
            mobile: '9765872910',
            sbhNumber: 'SBHF265512',
            hospitalId: 'HOSP-105',
            rank: 'RTD ARMY',
            admissionDate: '26/02/2083'
        },
        diagnosis: 'RT ACL, PCL, MCL TEAR',
        surgicalProcedure: 'DSAS+PCLR +/- ACLR+MCLR',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Severe Rt knee instability', hpi: 'Presented after pivoting injury during martial arts.', pmh: '', psh: '', medications: '', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'Mild effusion.', palpation: 'Medial joint line tender. Lacman positive +++', movements: 'Valgus stress laxity present', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 13.9, PAC Accepted: 29/02/2083', urine: 'Normal', imaging: 'MRI Knee: Triple ligament tear', others: '' },
        plan: [
            { id: 'p1', text: 'PAC Accepted', status: 'done' },
            { id: 'p2', text: 'Diagnostic Knee Arthroscopy + Ligament reconstruction', status: 'pending' }
        ],
        attachments: []
    },
    {
        id: '6',
        demographics: {
            name: 'SURENDRA BDR AIR',
            age: 35,
            sex: 'M',
            bedNumber: '3066',
            mobile: '9848728000',
            sbhNumber: 'SBH80202',
            hospitalId: 'HOSP-106',
            rank: 'REG ARMY',
            admissionDate: '26/02/2083'
        },
        diagnosis: 'RT KNEE MUCOID DEGENERATION OF ACL TEAR',
        surgicalProcedure: 'DEBRIDEMENT +ACLR DAS WITH ACL DECOMPRESSION',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Pain and catch in Rt knee', hpi: 'Ongoing knee pain for 6 months. Progressive stiffness.', pmh: '', psh: '', medications: '', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'No effusion.', palpation: 'MCL/LCL tenderless.', movements: 'Flexion painful at end-range.', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 13.2, PAC Approved: 27/02/2083', urine: 'Normal', imaging: 'MRI: Mucoid degeneration of ACL', others: 'Awaiting surgery scheduling' },
        plan: [
            { id: 'p1', text: 'PAC Accepted', status: 'done' },
            { id: 'p2', text: 'Perform ACL debridement & reconstruction', status: 'pending' }
        ],
        attachments: []
    },
    {
        id: '7',
        demographics: {
            name: 'NAR BAHADUR GIRI',
            age: 95,
            sex: 'M',
            bedNumber: '3138',
            mobile: '9827615631',
            sbhNumber: 'SBHF26582',
            hospitalId: 'HOSP-107',
            rank: 'RED FAM',
            admissionDate: '28/02/2083'
        },
        diagnosis: 'RT CLOSED NOF # SUB CAPITAL G-III WITH INTACT DNVS',
        classification: 'Garden Classification III',
        surgicalProcedure: 'RT HEMI-ARTHOPLASY',
        comorbidities: ['Advanced age (95 years)'],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Right hip pain following a domestic fall', hpi: 'Elderly gentleman sustained fall from bed. Complains of hip pain. Sensation intact.', pmh: 'None', psh: '', medications: '', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'Right leg externally rotated and shortened.', palpation: 'Severe tenderness and spasm over Rt groin.', movements: 'Unable to perform active straight leg raise.', neurovascular: 'Distal neurovascular status intact' } },
        investigations: { blood: 'Hb: 10.9 g/dL. PAC Pending cardiac/chest clearance. PAC Date: 29/02/2083', urine: 'Normal', imaging: 'X-ray Pelvis: Subcapital neck of femur fracture Garden III', others: '' },
        plan: [
            { id: 'p1', text: 'DUE CARDIAC AND CHEST CLEARANCE', status: 'pending' },
            { id: 'p2', text: 'Obtain Echo and physician assessment', status: 'pending' }
        ],
        attachments: []
    },
    {
        id: '8',
        demographics: {
            name: 'GHAM SINGH THAPA MAGAR',
            age: 7,
            sex: 'M',
            bedNumber: '3132',
            mobile: '9860676001',
            sbhNumber: 'SBHF39288',
            hospitalId: 'HOSP-108',
            rank: 'RTD FAM',
            admissionDate: '28/02/2083'
        },
        diagnosis: 'DOG BITE CATEGORY-III OVER DORSUM OF LEFT HAND SUSTAINED ON 2083/02/27',
        surgicalProcedure: 'SERIAL DEBRIDEMENT AND CLOSER',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Bleeding dog bite wound over left hand', hpi: '7-year-old child bit by stray dog, category III wound on dorsum of hand.', pmh: '', psh: '', medications: 'Anti-rabies scheduled', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'Puncture wounds over left dorsum of hand. Mild erythema.', palpation: 'Tender edges. Pulses intact.', movements: 'Finger extension limited due to pain.', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 11.5 g/dL', urine: 'Normal', imaging: 'X-ray Hand: No bony fractures', others: '' },
        plan: [
            { id: 'p1', text: 'DUE PAC evaluation', status: 'pending' },
            { id: 'p2', text: 'Antirabies vaccine and immunoglobulin administration', status: 'done' },
            { id: 'p3', text: 'Wound debridement and delayed secondary closure', status: 'pending' }
        ],
        attachments: []
    },
    {
        id: '9',
        demographics: {
            name: 'SAJAN GURUN',
            age: 36,
            sex: 'M',
            bedNumber: '3137',
            mobile: '9810067768',
            sbhNumber: 'SBH838112',
            hospitalId: 'HOSP-109',
            rank: 'REG ARMY',
            admissionDate: '27/02/2083'
        },
        diagnosis: 'RT RADIAL HEAD FRACTURE WITH LCL/MCL COMPLEX INJURY',
        surgicalProcedure: 'RT RADIAL HEAD ARTHOPLASY + LCL/LCL REPAIR',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Pain and deformity of Rt elbow', hpi: 'Elbow dislocations with comminuted radial head. Intact DNVS.', pmh: '', psh: '', medications: '', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'Swollen right elbow.', palpation: 'Proximal radioulnar joint tender.', movements: 'Pronation-supination locked', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 14.0', urine: 'Normal', imaging: 'X-ray and CT elbow: Comminuted radial head Mason Type III', others: '' },
        plan: [
            { id: 'p1', text: 'PAC Due', status: 'pending' },
            { id: 'p2', text: 'Obtain custom radial prosthesis implant', status: 'done' }
        ],
        attachments: []
    },
    {
        id: '10',
        demographics: {
            name: 'MANISH MALIK',
            age: 23,
            sex: 'M',
            bedNumber: '3136',
            mobile: '9826807372',
            sbhNumber: 'SBH82940',
            hospitalId: 'HOSP-110',
            rank: 'REG ARMY',
            admissionDate: '27/02/2083'
        },
        diagnosis: 'ACL WITH MM TEAR WITH INTACT DNVS',
        surgicalProcedure: 'LT DSAS WITH ACLR +MM PROCEDURE',
        comorbidities: ['Sinus Bradycardia (HR ~ 46 bpm)'],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Lt knee pain and recurrent instability', hpi: 'Sports-related twisting injury. Physical exam showed positive Lachman and McMurray tests.', pmh: 'Bradycardia noted', psh: '', medications: '', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'Mild effusion.', palpation: 'Medial joint line tenderness.', movements: 'Full extension, flexion restricted past 110 deg.', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 14.8. PAC: DUE CARDIAC CLEARANCE', urine: 'Normal', imaging: 'MRI Lt Knee: Complete tear of ACL and posterior horn tear of MM', others: 'ECG: Sinus Bradycardia (HR 46)' },
        plan: [
            { id: 'p1', text: 'NEED CARDIAC CLEARANCE / ECHO REVIEW', status: 'pending' },
            { id: 'p2', text: 'PAC Due', status: 'pending' }
        ],
        attachments: []
    },
    {
        id: '11',
        demographics: {
            name: 'KESHAR SINGH BUDHA MAGAR',
            age: 31,
            sex: 'M',
            bedNumber: '3142',
            mobile: '9867159945',
            sbhNumber: 'SBH80776',
            hospitalId: 'HOSP-111',
            rank: 'REG ARMY',
            admissionDate: '29/02/2083'
        },
        diagnosis: 'LT KNEE ACL TEAR (GRADE-III) WITH LM PH TEAR WITH INTACT DNVS',
        surgicalProcedure: 'ACLR + LM REPAIR',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Lt knee pain and instability', hpi: 'Presented with history of pivoting injury during physical training.', pmh: '', psh: '', medications: '', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'No gross swelling.', palpation: 'Lachman ++, Anterior drawer +', movements: 'ROM intact with joint line pain', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 13.9, PAC evaluation pending', urine: 'Normal', imaging: 'MRI: Grade-III ACL tear and Lateral meniscus posterior horn tear', others: '' },
        plan: [
            { id: 'p1', text: 'Awaiting PAC review', status: 'pending' },
            { id: 'p2', text: 'Procure bioabsorbable graft screws', status: 'pending' }
        ],
        attachments: []
    },
    {
        id: '13',
        demographics: {
            name: 'DIPAK BASKOTA',
            age: 28,
            sex: 'M',
            bedNumber: '3144',
            mobile: '9862756263',
            sbhNumber: 'SBH64765',
            hospitalId: 'HOSP-113',
            rank: 'REG ARMY',
            admissionDate: '29/02/2083'
        },
        diagnosis: 'LT LM + MM TEAR WITH INTACT DNVS',
        surgicalProcedure: 'DSAS +/- MENISCUS PROCEDURE',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Pain and lock of Lt knee', hpi: 'Presented following a minor twist, complaining of feeling a "pop" resulting in intermittent knee locks.', pmh: '', psh: '', medications: '', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'Mild swelling.', palpation: 'Point tenderness over medial joint space', movements: 'Extension block of 5 degrees', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 14.1 g/dL', urine: 'Normal', imaging: 'MRI Lt Knee: Horizontal tear of medial meniscus and vertical tear of lateral meniscus', others: '' },
        plan: [
            { id: 'p1', text: 'PAC Due', status: 'pending' },
            { id: 'p2', text: 'Pre-operative physical therapy', status: 'done' }
        ],
        attachments: []
    },
    {
        id: '14',
        demographics: {
            name: 'BHISMA RAJ GIRI',
            age: 22,
            sex: 'M',
            bedNumber: '3151',
            mobile: '9742264814',
            sbhNumber: 'SBH81247',
            hospitalId: 'HOSP-114',
            rank: 'REG ARMY',
            admissionDate: '19/02/2083'
        },
        diagnosis: 'WOUND DEHISCENCE S/P ILIZAROVE FIXATION WITH FIBULAR STAURT GRAFT FOR RT OPEN (GA- IIIA) PROXIMAL TIBIA AND FIBULA #',
        surgicalProcedure: 'SECONDARY CLOSER',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Wound dehiscence with exposed bone tissue', hpi: 'Admitted with open tibia fibula fracture managed previously with Ilizarov. Active wound dehiscence found over proximal tibia.', pmh: '', psh: 'S/P Ilizarov Assembly + Fibular bone strut graft', medications: 'IV antibiotics', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'Wound dehiscence size 4x3cm over proximal leg. Frame in situ.', palpation: 'Distal tibia intact. Strong posterior tibial pulse.', movements: 'Rigid fixation', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 11.2, WBC: 9.8k. PAC Accepted: 27/02/2083', urine: 'Normal', imaging: 'X-ray: Frame in situ, tibial alignment good, bridging consolidation visible', others: 'Wound swab: No active bacterial growth' },
        plan: [
            { id: 'p1', text: 'PAC Accepted', status: 'done' },
            { id: 'p2', text: 'Schedule secondary wound debridement and surgical closure', status: 'pending' }
        ],
        attachments: []
    },
    {
        id: '15',
        demographics: {
            name: 'JAY DUTTA BHATTA',
            age: 44,
            sex: 'M',
            bedNumber: '3156',
            mobile: '9841431508',
            sbhNumber: 'SBHF165219',
            hospitalId: 'HOSP-115',
            rank: 'RTD ARMY',
            admissionDate: '14/12/2083'
        },
        diagnosis: '39TH POD EXTERNAL FIXATOR WITH DEBRIDEMENT WITH ILIZAROVE FIXATION FOR LT GA-IIIA DISTAL FEMUR COMMINUTED # WITH INTACT DNVS',
        surgicalProcedure: 'IMPLANT REMOVAL',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Staged external hardware removal', hpi: '39th POD following distal femur open comminuted fracture management with external fixator.', pmh: 'Nil', psh: 'Femur external fixator placement', medications: '', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'Pin sites healthy, no purulent discharge or erythema.', palpation: 'Ex-fix stable.', movements: 'Partial weight bearing', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 12.0. PAC Accepted: 24/02/2083', urine: 'Normal', imaging: 'X-ray femur: Bridging callus formation noted.', others: '' },
        plan: [
            { id: 'p1', text: 'PAC Accepted', status: 'done' },
            { id: 'p2', text: 'External fixator implant removal + skeletal traction setup', status: 'pending' }
        ],
        attachments: []
    },
    {
        id: '16',
        demographics: {
            name: 'MANISHA BURLAKOTI',
            age: 36,
            sex: 'F',
            bedNumber: '3186',
            mobile: '986506941',
            sbhNumber: 'SBHF30131',
            hospitalId: 'HOSP-116',
            rank: 'REG ARMY',
            admissionDate: '27/02/2083'
        },
        diagnosis: 'RT SLAP LESION (GRADE-I) WITH SS TENDINOSIS',
        surgicalProcedure: 'SLAP + SS REPAIR',
        comorbidities: [],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Right shoulder deep-seated pain and clicking', hpi: '36/F complaining of right shoulder pain and weakness, especially during overhead movements.', pmh: '', psh: '', medications: '', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'No shoulder asymmetry.', palpation: 'Bicipital groove tender. Positive O\'Brien test', movements: 'External rotation painful', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 12.4. PAC Accepted: 29/02/2083', urine: 'Normal', imaging: 'MRI Shoulder: Superior labral tear from anterior to posterior (SLAP Grade-I) with supraspinatus tendinosis.', others: '' },
        plan: [
            { id: 'p1', text: 'PAC Accepted', status: 'done' },
            { id: 'p2', text: 'Schedule for diagnostic SLAP and SS Repair', status: 'pending' }
        ],
        attachments: []
    },
    {
        id: '17',
        demographics: {
            name: 'SAUJANYA CHAND',
            age: 25,
            sex: 'M',
            bedNumber: '3275',
            mobile: '9810267410',
            sbhNumber: 'SBH79L48',
            hospitalId: 'HOSP-117',
            rank: 'REG ARMY',
            admissionDate: '27/02/2082'
        },
        diagnosis: 'RT ACL TEAR WITH INTACT DNVS',
        surgicalProcedure: 'RT ACLR',
        comorbidities: ['Eosinophilia (Resolved)'],
        status: 'Pre-Op Workup',
        history: { chiefComplaint: 'Giving way of Right knee', hpi: 'Sustained injury on football field. Workup shows Eosinophilia is now resolved.', pmh: 'Eosinophilia history', psh: 'Nil', medications: 'Nil', allergies: '', socialHistory: '' },
        physicalExam: { localExam: { inspection: 'Mild wasting of quadriceps muscle in Right thigh.', palpation: 'Positive pivot shift test.', movements: 'Full extension, flexion intact.', neurovascular: 'Intact' } },
        investigations: { blood: 'Hb: 14.1 g/dL, Absolute Eosinophil Count is now within normal limits. PAC: DUE EOSINOPHILIA RESOLVED / NEED REVIEW', urine: 'Normal', imaging: 'MRI Rt knee: Complete ACL rupture.', others: 'Eosinophilia clearance obtained.' },
        plan: [
            { id: 'p1', text: 'DUE EOSINOPHILIA RESOLVED / NEED REVIEW', status: 'pending' },
            { id: 'p2', text: 'Pre-anesthetic evaluation and clearance confirmation', status: 'pending' }
        ],
        attachments: []
    }
];

const TEST_PRESETS_BY_GROUP = {
    Blood: [
        'Hb', 
        'WBC', 
        'Platelets', 
        'Creatinine', 
        'Urea', 
        'Glucose', 
        'Sodium', 
        'Potassium', 
        'Calcium', 
        'PT/INR', 
        'CRP', 
        'ESR', 
        'Blood Culture',
        'LFT (Liver Function Test)',
        'Serum Amylase'
    ],
    Urine: [
        'Urine R/E (Routine & Examination)',
        'Urine Culture & Sensitivity',
        'Urine Ketone Bodies',
        'Urine Specific Gravity'
    ],
    Radiology: [
        'X-ray Chest PA/AP',
        'X-ray AP/Lateral Right Femur',
        'X-ray AP/Lateral Left Femur',
        'X-ray AP/Lateral Right Tibia/Fibula',
        'X-ray AP/Lateral Left Tibia/Fibula',
        'X-ray Right Hip AP/Lateral',
        'X-ray Left Hip AP/Lateral',
        'X-ray Pelvis with both Hips AP',
        'X-ray Right Knee AP/Lateral',
        'X-ray Left Knee AP/Lateral',
        'X-ray Spine AP/Lateral',
        'CT Scan Knee/Hip/Shoulder',
        'CT Scan Brain/NCCT',
        'MRI Knee/Hip/Shoulder',
        'MRI Spine (Cervical/Lumbar)',
        'Ultrasound (USG) Abdomen & Pelvis',
        'DEXA Scan (Bone Mineral Density)'
    ],
    Fluids: [
        'Synovial Fluid Analysis (Cell Count, Crystals)',
        'Synovial Fluid Culture & Sensitivity',
        'Pleural Fluid routine analysis',
        'Ascitic Fluid routine analysis',
        'Cerebrospinal Fluid (CSF) analysis'
    ],
    Histopath: [
        'Bone Biopsy Histopathology',
        'Soft Tissue Tumor Histopathology',
        'Synovial Biopsy / Histopathology',
        'FNA Cytology (Fine Needle Aspiration)'
    ],
    Other: [
        'ECG (Electrocardiogram)',
        '2D Echo (Echocardiography)',
        'PFT (Pulmonary Function Test)',
        'Histopathology / Biopsy',
        'ABG (Arterial Blood Gas)',
        'NCV (Nerve Conduction Velocity)'
    ]
};

const BODY_SYSTEMS_LIST = [
    { key: 'constitutional', label: 'Constitutional', normalPreset: 'Conscious, oriented to time, place, and person. No signs of acute distress. Nutritional status adequate. Vitals stable.', category: 'Examinations' },
    { key: 'eyes', label: 'Eyes', normalPreset: 'Pupils equal, round, reactive to light and accommodation (PERRLA). Sclera is white, conjunctivae pink. Extraocular movements intact.', category: 'Examinations' },
    { key: 'enmt', label: 'ENMT', normalPreset: 'External ears normal. Nasal septum midline, mucosa pink without discharge. Oral mucosa moist, no throat congestion. Hearing grossly intact.', category: 'Examinations' },
    { key: 'neck', label: 'Neck', normalPreset: 'Supple. Trachea midline. Thyroid not enlarged. No cervical lymphadenopathy, carotid bruits, or elevated JVD.', category: 'Examinations' },
    { key: 'chestBreast', label: 'Chest / Breast', normalPreset: 'Chest wall symmetrical. Chest expansion equal bilaterally. No chest wall deformities, masses or tenderness.', category: 'Examinations' },
    { key: 'respiratory', label: 'Respiratory', normalPreset: 'Symmetrical chest expansion. Breath sounds clear bilaterally. No adventitious sounds (wheezes, rales, or rhonchi).', category: 'Examinations' },
    { key: 'cardiovascular', label: 'Cardiovascular', normalPreset: 'S1, S2 heard distinct and regular. No murmurs, gallops, or friction rubs. Distal extremity pulses are full and symmetric.', category: 'Examinations' },
    { key: 'gastrointestinal', label: 'Gastrointestinal', normalPreset: 'Abdomen soft, non-tender, non-distended. Spleen and liver not palpable. Active bowel sounds heard in all quadrants.', category: 'Examinations' },
    { key: 'genitourinaryFemale', label: 'Genitourinary Female', normalPreset: 'Deferred/Examined and found normal. No symptoms or signs of infection, discharge, or lesions.', category: 'Examinations' },
    { key: 'genitourinaryMale', label: 'Genitourinary Male', normalPreset: 'Deferred/Examined and found normal. No inguinal hernia, scrotal swelling, or penile lesions.', category: 'Examinations' },
    { key: 'musculoskeletal', label: 'Musculoskeletal', normalPreset: 'No spinal deformities or tenderness. Symmetrical muscle bulk. Full active ROM in all non-injured joints, no sign of effusions.', category: 'Examinations' },
    { key: 'integumentary', label: 'Integumentary', normalPreset: 'Skin is warm, dry, with turgor intact. No abnormal rashes, erythema, scale, or ulcerations. Surgical dressings clean.', category: 'Examinations' },
    { key: 'neurological', label: 'Neurological', normalPreset: 'CN II-XII grossly intact. Motor power 5/5 globally in non-injured extremities. Sensory intact. Normal deep tendon reflexes.', category: 'Examinations' },
    { key: 'psychiatric', label: 'Psychiatric', normalPreset: 'Cooperative. Logical, goal-directed thoughts. Intact judgement and insight. Affect matches mood and context.', category: 'Examinations' },
    { key: 'endocrine', label: 'Endocrine', normalPreset: 'No physical findings of thyroid hypertrophy or endocrine disease. Normal hair and skin texture.', category: 'Examinations' }
];

interface DropdownOption {
    value: string;
    label: string;
}

function CustomSearchableDropdown({
    label,
    value,
    options,
    onChange,
    placeholder = "Select...",
    searchable = true
}: {
    label?: string;
    value: string;
    options: string[] | DropdownOption[];
    onChange: (val: string) => void;
    placeholder?: string;
    searchable?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent | TouchEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, []);

    const normalizedOptions: DropdownOption[] = options.map(opt => 
        typeof opt === 'string' ? { value: opt, label: opt } : opt
    );

    const filteredOptions = normalizedOptions.filter(opt => 
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedOption = normalizedOptions.find(opt => opt.value === value);

    return (
        <div className="space-y-1 relative w-full text-left" ref={dropdownRef}>
            {label && (
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearchQuery('');
                }}
                className="w-full flex items-center justify-between text-xs font-bold px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]/30 focus:border-[#0077b6] text-left transition-all cursor-pointer"
            >
                <span className={value ? 'text-slate-800 dark:text-slate-200 truncate pr-2' : 'text-slate-400 dark:text-slate-500 font-medium truncate pr-2'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-[#0077b6]' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-60">
                    {searchable && normalizedOptions.length > 4 && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center gap-1.5">
                            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search options..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full text-xs font-medium bg-transparent border-none outline-none focus:ring-0 p-0 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                    <div className="overflow-y-auto py-1 divide-y divide-slate-100/30 dark:divide-slate-800/20">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <button
                                    type="button"
                                    key={opt.value}
                                    onMouseDown={(e) => {
                                        // Prevents default focus changes and click-outside dismissal cycle
                                        e.preventDefault();
                                    }}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs font-semibold hover:bg-[#0077b6]/10 hover:text-[#0077b6] dark:hover:bg-[#0077b6]/10 transition-colors flex items-center justify-between
                                        ${opt.value === value 
                                            ? 'text-[#0077b6] dark:text-sky-400 bg-blue-50/30 dark:bg-[#0077b6]/5 font-bold' 
                                            : 'text-slate-700 dark:text-slate-300'}`}
                                >
                                    <span className="truncate pr-2">{opt.label}</span>
                                    {opt.value === value && (
                                        <CheckCircle className="h-3.5 w-3.5 text-[#0077b6] dark:text-sky-400 shrink-0" />
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-3 text-center text-xs text-slate-400 italic">
                                No options found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MiniEMR() {
    const [patients, setPatients] = useState<OrthoPatient[]>(() => {
        const saved = localStorage.getItem('gmed_patients');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Error loading gmed_patients from localStorage", e);
            }
        }
        return InitialPatients.map((p, idx) => {
            const tasks: PatientTask[] = p.tasks || [
                { id: 't1-' + p.id, category: 'Before round', title: 'Check morning vitals', assignedTo: 'Intern', priority: 'Routine', status: 'pending' },
                { id: 't2-' + p.id, category: 'After round', title: 'Prepare dressing material', assignedTo: 'Ward sister', priority: 'Routine', status: 'done' },
                { id: 't3-' + p.id, category: 'Resident', title: 'Check PAC fitness status', assignedTo: 'Resident', priority: 'Urgent', status: p.pacStatus === 'FIT' ? 'done' : 'pending' }
            ];
            return {
                ...p,
                tasks,
                otSequence: p.otSequence || (idx + 1),
                estimatedDurationMinutes: p.estimatedDurationMinutes || (idx % 2 === 0 ? 90 : 60),
                surgerySide: p.surgerySide || 'Right',
                isImplantReady: p.isImplantReady ?? true,
                isInstrumentReady: p.isInstrumentReady ?? true,
                isC_armNeeded: p.isC_armNeeded ?? true,
                isTourniquetNeeded: p.isTourniquetNeeded ?? true,
                bloodRequirementText: p.bloodRequirementText || '1 Unit PRBC',
                specialPositionText: p.specialPositionText || 'Supine with side-post',
                infectionPrecautionChecked: p.infectionPrecautionChecked ?? false,
                pacNotFitReasonChecklist: p.pacNotFitReasonChecklist || [],
                consultSpecialty: p.consultSpecialty || 'Medicine',
                consultStatus: p.consultStatus || 'Completed'
            };
        });
    });
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(() => {
        const saved = localStorage.getItem('gmed_patients');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.length > 0) {
                    return parsed[0].id;
                }
            } catch (e) {
                console.error("Error loading default selectedPatientId from localStorage", e);
            }
        }
        return InitialPatients[0].id;
    });
    const [activeTab, setActiveTab] = useState<EMRTab>('summary');
    const [searchTerm, setSearchTerm] = useState('');
    const [shorthandInput, setShorthandInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [isEditingDischarge, setIsEditingDischarge] = useState(false);
    const [isDischargeHistoryOpen, setIsDischargeHistoryOpen] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);
    const [emrSaveStatus, setEmrSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [emrLastSavedTime, setEmrLastSavedTime] = useState<string | null>(() => {
        const saved = localStorage.getItem('gmed_patients');
        if (saved) {
            const now = new Date();
            return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        return null;
    });
    const [isAnalyzingImage, setIsAnalyzingImage] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'dashboard' | 'list' | 'ward-summary' | 'ward-duties' | 'ot-list'>('dashboard');
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<string[]>([
        'Incoming Bed 12: RT CLOSED DISTAL 3RD TIBIA #',
        'Lab Alert Bed 4: Hb is 7.2 g/dL (Critical)',
        'PAC clearance pending for SANJOG K'
    ]);
    const [wardUpdateText, setWardUpdateText] = useState('');
    const [isWardUpdateModalOpen, setIsWardUpdateModalOpen] = useState(false);
    const [otViewType, setOtViewType] = useState<'board' | 'spreadsheet'>('board');
    const [otSearch, setOtSearch] = useState('');
    const [otOverrides, setOtOverrides] = useState<Record<string, 'trauma' | 'arthroscopy'>>({});
    const [otScheduleDate, setOtScheduleDate] = useState('2083/03/22 (MONDAY)');
    const [otScheduleTitle, setOtScheduleTitle] = useState('“OT LIST - UNIT-I” FOR 2083/03/22(MONDAY)');
    const [otSurgeonsRoster, setOtSurgeonsRoster] = useState('COL.DR. NIRAB KAYASTHA/LT.COL.DR.RITESH SINHA/LT. COL. DR RAVI BHANDARI/LT. COL. DR MOHIT THAPA MAGAR/MAJ. DR. AMIR RATNA SHAKYA/MAJ.KISORE KHATTR/MAJ. DR. BIRAJ KC');
    const [isInlineEditing, setIsInlineEditing] = useState(false);
    const [wardDuties, setWardDuties] = useState<string[]>([]);
    const [isAddingPatient, setIsAddingPatient] = useState(false);
    const [copied, setCopied] = useState(false);
    const [headerCopied, setHeaderCopied] = useState(false);

    // Body Systems & ROS States
    const [selectedBodySystem, setSelectedBodySystem] = useState<string | null>(null);
    const [activeAdditionalOp, setActiveAdditionalOp] = useState<'pfsh' | 'questionnaire' | null>(null);
    const [bodySystemNotes, setBodySystemNotes] = useState<string>('');
    const [bodySystemStatus, setBodySystemStatus] = useState<'Not Examined' | 'Examined' | 'Abnormal'>('Not Examined');

    // Dynamic/Interactive Structured Investigation States
    const [invType, setInvType] = useState<'Blood' | 'Urine' | 'Radiology' | 'Fluids' | 'Histopath' | 'Other'>('Blood');
    const [invName, setInvName] = useState('');
    const [invStatus, setInvStatus] = useState<'Not ordered' | 'Ordered' | 'Sent' | 'Report pending' | 'Received' | 'Reviewed' | 'Send' | 'Sample Sent' | 'Report Pending' | 'Came'>('Report pending');
    const [invResult, setInvResult] = useState('');
    const [editingInvId, setEditingInvId] = useState<string | null>(null);

    // X-ray Comparison States
    const [compareXray1Id, setCompareXray1Id] = useState<string>('');
    const [compareXray2Id, setCompareXray2Id] = useState<string>('');
    const [comparisonSummary, setComparisonSummary] = useState<string>('');
    const [isComparingXrays, setIsComparingXrays] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);

    useEffect(() => {
        setCompareXray1Id('');
        setCompareXray2Id('');
        setComparisonSummary('');
        setIsComparingXrays(false);
        setShareSuccess(false);
        setActiveTab('hub');
    }, [selectedPatientId]);

    // Hands-free Speech Dictation States
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [speechError, setSpeechError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognitionClass) {
            setSpeechSupported(true);
            const r = new SpeechRecognitionClass();
            r.continuous = true;
            r.interimResults = true;
            r.lang = 'en-US';

            r.onstart = () => {
                setIsListening(true);
                setSpeechError(null);
            };

            r.onend = () => {
                setIsListening(false);
            };

            r.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
                if (event.error === 'not-allowed') {
                    setSpeechError('Microphone permissions blocked (within sandbox/frame). Please click to type instead.');
                } else {
                    setSpeechError(`Speech recognition disabled: ${event.error}`);
                }
                setTimeout(() => setSpeechError(null), 8500);
            };

            r.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (finalTranscript) {
                    setShorthandInput(prev => {
                        const spacer = prev && !prev.endsWith(' ') ? ' ' : '';
                        return prev + spacer + finalTranscript;
                    });
                }
            };

            recognitionRef.current = r;
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore if already stopped
                }
            }
        };
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
            } catch (err) {
                console.error("Error starting speech recognition:", err);
            }
        }
    };

    // Quick Record Menu / Drawer States
    const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [quickMenuTab, setQuickMenuTab] = useState<'progress' | 'handover' | 'stopwatch'>('progress');
    
    // Quick SOAP States
    const [quickSubjective, setQuickSubjective] = useState('');
    const [quickObjective, setQuickObjective] = useState('');
    const [quickAssessment, setQuickAssessment] = useState('');
    const [quickPlanText, setQuickPlanText] = useState('');
    const [quickBP, setQuickBP] = useState('');
    const [quickPulse, setQuickPulse] = useState('');
    const [quickSpO2, setQuickSpO2] = useState('');
    const [quickTemp, setQuickTemp] = useState('');

    // Quick Handover States
    const [quickHandoverText, setQuickHandoverText] = useState('');

    const openQuickMenu = (type: 'progress' | 'handover' | 'stopwatch', patient: OrthoPatient) => {
        setQuickMenuTab(type);
        if (patient) {
            setQuickHandoverText(patient.nurseHandover || '');
            setQuickBP(patient.physicalExam?.vitals?.bp || '');
            setQuickPulse(patient.physicalExam?.vitals?.pulse ? String(patient.physicalExam.vitals.pulse) : '');
            setQuickSpO2(patient.physicalExam?.vitals?.spo2 ? String(patient.physicalExam.vitals.spo2) : '');
            setQuickTemp(patient.physicalExam?.vitals?.temp ? String(patient.physicalExam.vitals.temp) : '');
            setQuickAssessment(patient.diagnosis || '');
            setQuickSubjective('');
            setQuickObjective('');
            setQuickPlanText('');
        }
        setIsQuickMenuOpen(true);
    };

    const handleSaveQuickProgress = (patientId: string) => {
        const noteId = Date.now().toString();
        const newNote = {
            id: noteId,
            date: new Date().toISOString(),
            vitals: {
                bp: quickBP,
                pulse: parseInt(quickPulse) || 0,
                temp: parseFloat(quickTemp) || 0,
                rr: 18,
                spo2: parseInt(quickSpO2) || 0,
                timestamp: new Date().toISOString()
            },
            subjective: quickSubjective || 'Patient stable, pain controlled.',
            objective: quickObjective || 'Vitals monitored. Dressing intact/dry.',
            assessment: quickAssessment || 'Review diagnosis.',
            plan: quickPlanText || 'Continue current orthopaedic treatment plan.',
            addedBy: 'Resident (Quick)'
        };
        
        setPatients(prev => prev.map(p => {
            if (p.id === patientId) {
                return {
                    ...p,
                    dailyNotes: [newNote, ...(p.dailyNotes || [])]
                };
            }
            return p;
        }));
        
        setIsQuickMenuOpen(false);
    };

    const handleSaveQuickHandover = (patientId: string) => {
        const handoverId = Date.now().toString();
        const newHandoverItem = {
            id: handoverId,
            date: new Date().toISOString(),
            text: quickHandoverText,
            addedBy: 'Resident (Quick)'
        };
        
        setPatients(prev => prev.map(p => {
            if (p.id === patientId) {
                return {
                    ...p,
                    nurseHandover: quickHandoverText,
                    nurseHandovers: [newHandoverItem, ...(p.nurseHandovers || [])]
                };
            }
            return p;
        }));
        
        setIsQuickMenuOpen(false);
    };

    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    const latestDischargeTextRef = useRef<string>('');
    const latestDischargeDraftsRef = useRef<any[]>([]);

    useEffect(() => {
        if (selectedPatient) {
            latestDischargeTextRef.current = selectedPatient.dischargeNote || selectedPatient.soapNote || '';
            latestDischargeDraftsRef.current = selectedPatient.dischargeDrafts || [];
        } else {
            latestDischargeTextRef.current = '';
            latestDischargeDraftsRef.current = [];
        }
    }, [selectedPatient]);

    useEffect(() => {
        if (activeTab !== 'discharge' || !selectedPatientId) {
            setAutoSaveStatus('idle');
            return;
        }

        const intervalId = setInterval(() => {
            const currentText = latestDischargeTextRef.current;
            const currentDrafts = latestDischargeDraftsRef.current;
            
            if (!currentText.trim()) return;

            const lastDraft = currentDrafts.length > 0 ? currentDrafts[currentDrafts.length - 1] : null;
            if (lastDraft && lastDraft.content === currentText) {
                return;
            }

            setAutoSaveStatus('saving');

            setPatients(prevPatients => {
                return prevPatients.map(p => {
                    if (p.id === selectedPatientId) {
                        const drafts = p.dischargeDrafts || [];
                        const lastDraftIndex = drafts.length - 1;
                        
                        let updatedDrafts = [...drafts];
                        const timestamp = new Date().toLocaleString();

                        if (drafts.length > 0) {
                            updatedDrafts[lastDraftIndex] = {
                                ...updatedDrafts[lastDraftIndex],
                                date: `${timestamp} (Auto-saved)`,
                                content: currentText
                            };
                        } else {
                            updatedDrafts.push({
                                id: Date.now().toString(),
                                date: `${timestamp} (Auto-saved)`,
                                content: currentText
                            });
                        }

                        return {
                            ...p,
                            dischargeDrafts: updatedDrafts
                        };
                    }
                    return p;
                });
            });

            setAutoSaveStatus('saved');
            const now = new Date();
            setLastAutoSaveTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            setTimeout(() => {
                setAutoSaveStatus('idle');
            }, 3000);

        }, 30000);

        return () => clearInterval(intervalId);
    }, [activeTab, selectedPatientId]);

    // Save to local storage automatically on any patients state change with debounced visual status feedback
    useEffect(() => {
        if (patients && patients.length > 0) {
            localStorage.setItem('gmed_patients', JSON.stringify(patients));
            setEmrSaveStatus('saving');
            const handler = setTimeout(() => {
                setEmrSaveStatus('saved');
                const now = new Date();
                setEmrLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
                
                const idleHandler = setTimeout(() => {
                    setEmrSaveStatus('idle');
                }, 2000);
                return () => clearTimeout(idleHandler);
            }, 600);
            return () => clearTimeout(handler);
        }
    }, [patients]);

    const filteredPatients = patients.filter(p => {
        const matchesSearch = 
            p.demographics.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.demographics.bedNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.demographics.sbhNumber.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;

        if (activeFilter) {
            const f = activeFilter.toLowerCase();
            if (f === 'total-admitted') {
                return true;
            }
            if (f === 'newly-admitted') {
                return p.demographics.admissionDate !== undefined;
            }
            if (f === 'under-evaluation') {
                return p.status.toLowerCase().includes('evaluation') || p.status.toLowerCase().includes('eval') || p.status.toLowerCase().includes('workup');
            }
            if (f === 'conservative') {
                return p.status.toLowerCase().includes('conservative');
            }
            if (f === 'pre-operative' || f === 'pre-op') {
                return p.status.toLowerCase().includes('pre-op') || p.status.toLowerCase().includes('workup');
            }
            if (f === 'pac-pending') {
                return (p.status.toLowerCase().includes('pre-op') || p.status.toLowerCase().includes('workup')) && p.pacStatus !== 'FIT' && p.pacStatus !== 'Accepted' && p.pacStatus !== 'Fit';
            }
            if (f === 'ot-planned') {
                return !!p.otNumber || p.plan.some(it => /ot|surgery|orif|crif|nailing/i.test(it.text)) || p.status.toLowerCase().includes('planned');
            }
            if (f === 'post-operative' || f === 'post-op') {
                return p.status.toLowerCase().includes('post-op');
            }
            if (f === 'discharge-planned' || f === 'discharge') {
                return p.status.toLowerCase().includes('discharge') || p.status.toLowerCase().includes('ready') || p.status.toLowerCase().includes('plan');
            }
            if (f === 'urgent-tasks' || f === 'urgent') {
                return p.quickNotesCategory === 'Urgent' || p.tasks?.some(t => t.priority === 'Urgent' && t.status === 'pending') || p.plan.some(it => it.status === 'pending' && /urgent/i.test(it.text));
            }
            if (f === 'ot-tomorrow') {
                return !!p.otNumber || p.status.toLowerCase().includes('pre-op');
            }
            if (f === 'consult-pending') {
                return p.plan.some(it => /consult/i.test(it.text)) || p.consultStatus === 'Requested' || p.consultCardioClearance?.toLowerCase().includes('requested');
            }
            if (f === 'investigation-pending') {
                return p.investigations?.structuredList?.some(i => i.status === 'Send' || i.status === 'Sample Sent' || i.status === 'Report Pending') || p.plan.some(it => /(lab|blood|x-?ray|mri|ct)/i.test(it.text));
            }
            // fallback previous filters
            if (f === 'pac') {
                return p.status.toLowerCase().includes('pre-op');
            }
            if (f === 'consultation') {
                return p.plan.some(it => /consult/i.test(it.text));
            }
            if (f === 'investigations') {
                return p.plan.some(it => /(lab|blood|x-?ray|mri|ct)/i.test(it.text));
            }
            if (f === 'implant') {
                return /implant|screw|nail|plate/i.test(p.surgicalProcedure || '');
            }
            if (f === 'follow-up') {
                return !!p.followUpDate;
            }
        }
        return true;
    });

    const handleShorthandSubmit = async () => {
        if (!shorthandInput.trim() || !selectedPatient) return;

        setIsProcessing(true);
        try {
            const updatedData = await parseShorthandToOrthopedicData(shorthandInput, selectedPatient);
            
            setPatients(prev => prev.map(p => {
                if (p.id === selectedPatient?.id) {
                    return {
                        ...p,
                        ...updatedData,
                        id: p.id,
                        demographics: { ...p.demographics, ...updatedData.demographics },
                        investigations: { ...p.investigations, ...updatedData.investigations },
                        plan: updatedData.plan && updatedData.plan.length > 0 ? (updatedData.plan as PatientPlanItem[]) : p.plan,
                        history: updatedData.history ? { ...(p.history || {}), ...updatedData.history } : p.history,
                        physicalExam: updatedData.physicalExam ? { 
                            ...(p.physicalExam || {}), 
                            ...updatedData.physicalExam,
                            vitals: {
                                ...(p.physicalExam?.vitals || {}),
                                ...(updatedData.physicalExam?.vitals || {})
                            },
                            localExam: {
                                ...(p.physicalExam?.localExam || {}),
                                ...(updatedData.physicalExam?.localExam || {})
                            }
                        } : p.physicalExam
                    };

                    // Background auto-generation of discharge note to keep it updated seamlessly
                    setTimeout(() => {
                        generateDischargeSummaryFromAI(mergedPatient).then(summary => {
                            setPatients(curr => curr.map(cp => cp.id === mergedPatient.id ? { ...cp, dischargeNote: summary } : cp));
                        }).catch(console.error);
                    }, 0);

                    return mergedPatient;
                }
                return p;
            }));
            
            setShorthandInput('');
        } catch (error) {
            console.error(error);
            alert("Failed to process shorthand note. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    const togglePlanItem = (patientId: string, planId: string) => {
        setPatients(prev => prev.map(p => {
            if (p.id === patientId) {
                return {
                    ...p,
                    plan: p.plan.map(plan => 
                        plan.id === planId ? { ...plan, status: plan.status === 'pending' ? 'done' : 'pending' } : plan
                    )
                };
            }
            return p;
        }));
    };

    const handleDeletePatient = (patientId: string) => {
        if (confirm("Are you sure you want to remove this patient from the tracker?")) {
            setPatients(prev => prev.filter(p => p.id !== patientId));
            if (selectedPatientId === patientId) setSelectedPatientId(null);
        }
    };

    const handleAddPatientClick = () => {
        const newPatientId = Date.now().toString();
        const newPatient: OrthoPatient = {
            id: newPatientId,
            demographics: { 
                name: 'New Patient', 
                age: '', 
                sex: 'Other', 
                mobile: '', 
                bedNumber: 'TBD', 
                hospitalId: 'TBD', 
                sbhNumber: 'TBD',
                admissionDate: new Date().toISOString().split('T')[0]
            },
            diagnosis: 'Undiagnosed',
            comorbidities: [],
            status: 'Admission',
            history: {
                chiefComplaint: '', hpi: '', pmh: '', psh: '', medications: '', allergies: '', socialHistory: ''
            },
            physicalExam: {
                general: '',
                vitals: { bp: '', pulse: 0, temp: 0, rr: 0, spo2: 0, timestamp: new Date().toISOString() },
                localExam: { inspection: '', palpation: '', movements: '', neurovascular: '' }
            },
            investigations: { blood: '', urine: '', imaging: '' },
            plan: [],
            attachments: [],
            soapNote: '',
            tasks: [
                { id: 't1-' + newPatientId, category: 'Before round', title: 'Check morning vitals', assignedTo: 'Intern', priority: 'Routine', status: 'pending' },
                { id: 't2-' + newPatientId, category: 'After round', title: 'Prepare dressing material', assignedTo: 'Ward sister', priority: 'Routine', status: 'done' },
                { id: 't3-' + newPatientId, category: 'Resident', title: 'Check PAC fitness status', assignedTo: 'Resident', priority: 'Urgent', status: 'pending' }
            ],
            otSequence: patients.length + 1,
            estimatedDurationMinutes: 60,
            surgerySide: 'Right',
            isImplantReady: true,
            isInstrumentReady: true,
            isC_armNeeded: true,
            isTourniquetNeeded: true,
            bloodRequirementText: '1 Unit PRBC',
            specialPositionText: 'Supine with side-post',
            infectionPrecautionChecked: false,
            pacNotFitReasonChecklist: [],
            consultSpecialty: 'Medicine',
            consultStatus: 'Completed'
        };
        setPatients([...patients, newPatient]);
        setSelectedPatientId(newPatientId);
        setActiveTab('demographics'); // Go to demographics to fill data
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedPatient) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const newAttachment: PatientAttachment = {
                id: Date.now().toString(),
                name: file.name,
                type: file.type.includes('image') ? 'xray' : 'report',
                url: base64String,
                timestamp: new Date().toLocaleString()
            };

            setPatients(prev => prev.map(p => {
                if (p.id === selectedPatient.id) {
                    return { ...p, attachments: [...p.attachments, newAttachment] };
                }
                return p;
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyzeXray = async (attachmentId: string) => {
        if (!selectedPatient) return;
        const attachment = selectedPatient.attachments.find(a => a.id === attachmentId);
        if (!attachment || attachment.type !== 'xray') return;

        setIsAnalyzingImage(attachmentId);
        try {
            const interpretation = await interpretXrayImage(attachment.url);
            setPatients(prev => prev.map(p => {
                if (p.id === selectedPatient.id) {
                    return {
                        ...p,
                        attachments: p.attachments.map(a => 
                            a.id === attachmentId ? { ...a, aiInterpretation: interpretation } : a
                        )
                    };
                }
                return p;
            }));
        } catch (error) {
            console.error(error);
            alert("Failed to analyze image.");
        } finally {
            setIsAnalyzingImage(null);
        }
    };

    const handleCompareXrays = async () => {
        if (!selectedPatient) return;
        const xray1 = selectedPatient.attachments.find(a => a.id === compareXray1Id);
        const xray2 = selectedPatient.attachments.find(a => a.id === compareXray2Id);
        if (!xray1 || !xray2) return;

        setIsComparingXrays(true);
        setComparisonSummary('');
        try {
            const summary = await compareXrayImages(xray1.url, xray2.url, xray1.name, xray2.name);
            setComparisonSummary(summary);
        } catch (error) {
            console.error(error);
            setComparisonSummary("Failed to generate comparative analysis. Please try again.");
        } finally {
            setIsComparingXrays(false);
        }
    };

    const handleShareComparison = async () => {
        if (!comparisonSummary || !selectedPatient) return;
        const xray1 = selectedPatient.attachments.find(a => a.id === compareXray1Id);
        const xray2 = selectedPatient.attachments.find(a => a.id === compareXray2Id);
        
        const shareTitle = `Radiographic Comparison Report - ${selectedPatient.name}`;
        const shareText = `G-MED 3.0 Clinical Radiographic Comparison Report for patient ${selectedPatient.name} (ID: ${selectedPatient.hospitalId || 'N/A'}).\n\nCompared X-rays:\n- Image A: ${xray1?.name || 'Baseline'}\n- Image B: ${xray2?.name || 'Follow-up'}\n\nComparative Analysis Summary:\n${comparisonSummary}\n\nAI-generated summary. Must be verified by the Resident/Attending.`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                });
                setShareSuccess(true);
                setTimeout(() => setShareSuccess(false), 2000);
            } catch (error) {
                console.error("Error sharing via navigator.share:", error);
                // Fallback to clipboard
                try {
                    await navigator.clipboard.writeText(shareText);
                    setShareSuccess(true);
                    setTimeout(() => setShareSuccess(false), 2000);
                } catch (err) {
                    console.error("Clipboard fallback failed:", err);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareText);
                setShareSuccess(true);
                setTimeout(() => setShareSuccess(false), 2000);
            } catch (err) {
                console.error("Clipboard copy failed:", err);
            }
        }
    };

    const handleGenerateDischargeSummary = async () => {
        if (!selectedPatient) return;
        setIsGeneratingSummary(true);
        try {
            const summary = await generateDischargeSummaryFromAI(selectedPatient);
            const newDraft = { id: Date.now().toString(), date: new Date().toLocaleString(), content: summary };
            const updatedDrafts = [...(selectedPatient.dischargeDrafts || []), newDraft];
            updatePatient(selectedPatient.id, { 
                dischargeNote: summary,
                dischargeDrafts: updatedDrafts
            });
        } catch (error) {
            console.error(error);
            alert("Failed to generate summary.");
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const handleGenerateHospitalCourse = async () => {
        if (!selectedPatient) return;
        setIsGeneratingSummary(true);
        try {
            const courseSummary = await generateCourseOfHospitalStay(selectedPatient);
            updatePatient(selectedPatient.id, { hospitalCourse: courseSummary });
        } catch (error) {
            console.error(error);
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const renderSummary = (patient: OrthoPatient) => (
        <div className="space-y-6">
            <ExecutiveBriefingCard 
                patient={patient}
                onNavigate={(tab) => setActiveTab(tab)}
                updatePatient={updatePatient}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {patient.dangerSigns && patient.dangerSigns.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-900/40 animate-pulse ring-2 ring-red-500 ring-offset-2 dark:ring-offset-slate-900">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            <h4 className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">
                                DANGER SIGNS DETECTED!
                            </h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {patient.dangerSigns.map(sign => (
                                <span key={sign} className="px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-black shadow-sm">
                                    {sign}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                {patient.plannedSurgeryTime && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in print:hidden">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0">
                                <Clock className="h-4 w-4 animate-pulse" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200">
                                    Upcoming Scheduled Case: <span className="text-[#0077b6] dark:text-blue-400">{patient.surgicalProcedure || 'Orthopedic Intervention'}</span>
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                    Target Time: {new Date(patient.plannedSurgeryTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveTab('plan')}
                                className="px-3 py-2 bg-[#0077b6] hover:bg-[#005f92] text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                            >
                                <Timer className="h-3 w-3" /> Action Center
                            </button>
                        </div>
                    </div>
                )}
                {/* Diagnosis & Classification Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase block mb-2 tracking-widest text-[#0077b6]">Primary Diagnosis</span>
                            <div className="space-y-2">
                                <CustomSearchableDropdown
                                    value={ORTHO_DIAGNOSES.includes(patient.diagnosis) ? patient.diagnosis : "Manual"}
                                    onChange={(val) => {
                                        if (val !== "Manual") {
                                            updatePatient(patient.id, { diagnosis: val });
                                        }
                                    }}
                                    placeholder="Select diagnosis..."
                                    options={[
                                        ...ORTHO_DIAGNOSES.map(d => ({ value: d, label: d })),
                                        { value: "Manual", label: "-- OTHER (MANUAL ENTRY) --" }
                                    ]}
                                />
                                <div className="relative">
                                    <input 
                                        type="text"
                                        value={patient.diagnosis}
                                        onChange={(e) => updatePatient(patient.id, { diagnosis: e.target.value })}
                                        placeholder="Type manual diagnosis here..."
                                        className="w-full text-sm font-bold p-2.5 bg-white dark:bg-slate-900 border-2 border-dashed border-[#0077b6]/30 dark:border-[#0077b6]/20 rounded-lg outline-none focus:border-[#0077b6] transition-all"
                                    />
                                    <div className="absolute right-2 top-2 p-1">
                                        <Sparkles className="h-4 w-4 text-[#0077b6] opacity-30" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                            <div className="md:col-span-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest text-[#0077b6]">Mechanism of Injury (MOI)</span>
                                <select 
                                    value={MOI_OPTIONS.includes(patient.moi || '') ? patient.moi : (patient.moi ? "Other" : "")}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "Other") {
                                            updatePatient(patient.id, { moi: "Other: " });
                                        } else {
                                            updatePatient(patient.id, { moi: val });
                                        }
                                    }}
                                    className="hidden"
                                ></select>
                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                    {MOI_OPTIONS.map(opt => {
                                        const isSelected = patient.moi === opt || (opt === "Other" && patient.moi?.startsWith("Other:"));
                                        return (
                                            <button
                                                key={opt}
                                                onClick={() => updatePatient(patient.id, { moi: opt === 'Other' ? 'Other: ' : opt })}
                                                className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${isSelected ? 'bg-[#0077b6] text-white border-[#0077b6] shadow-sm' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#0077b6]/50'}`}
                                            >
                                                {opt.replace(' (Road Traffic Accident)', '')}
                                            </button>
                                        );
                                    })}
                                </div>
                                {patient.moi?.startsWith("Other:") && (
                                    <input 
                                        type="text"
                                        value={patient.moi.startsWith("Other: ") ? patient.moi.replace("Other: ", "") : patient.moi.replace("Other:", "")}
                                        placeholder="Type custom MOI..."
                                        onChange={(e) => updatePatient(patient.id, { moi: "Other: " + e.target.value })}
                                        className="w-full text-[11px] font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-[#0077b6]"
                                    />
                                )}
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest text-[#0077b6]">Injury Date</span>
                                <input 
                                    type="date"
                                    value={patient.injuryDate || ''}
                                    onChange={(e) => updatePatient(patient.id, { injuryDate: e.target.value })}
                                    className="w-full text-[11px] font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6]"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest text-[#0077b6]">Injury Time</span>
                                <input 
                                    type="time"
                                    value={patient.injuryTime || ''}
                                    onChange={(e) => updatePatient(patient.id, { injuryTime: e.target.value })}
                                    className="w-full text-[11px] font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6]"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest text-[#0077b6]">Classification</span>
                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                    {ORTHO_CLASSIFICATIONS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => updatePatient(patient.id, { classification: c })}
                                            className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${patient.classification === c ? 'bg-[#0077b6] text-white border-[#0077b6] shadow-sm' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#0077b6]/50'}`}
                                        >
                                            {c.split(' (')[0]}
                                        </button>
                                    ))}
                                </div>
                                {(!ORTHO_CLASSIFICATIONS.includes(patient.classification || "") && patient.classification !== undefined) && (
                                    <input 
                                        type="text"
                                        value={patient.classification || ''}
                                        onChange={(e) => updatePatient(patient.id, { classification: e.target.value })}
                                        placeholder="Type manual classification..."
                                        className="mt-1.5 w-full text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 outline-none focus:ring-1 focus:ring-[#0077b6]"
                                    />
                                )}
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-widest text-[#0077b6]">Type / Grade</span>
                                <input 
                                    type="text"
                                    value={patient.fractureType || ''}
                                    onChange={(e) => updatePatient(patient.id, { fractureType: e.target.value })}
                                    placeholder="e.g. Type 32-A3"
                                    className="w-full text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 outline-none focus:ring-1 focus:ring-[#0077b6]"
                                />
                                <div className="mt-1.5 flex gap-1">
                                    {['I', 'II', 'IIIA', 'IIIB', 'IV'].map(g => (
                                        <button 
                                            key={g} 
                                            onClick={() => updatePatient(patient.id, { fractureType: g })}
                                            className="text-[8px] px-1 bg-blue-50/50 dark:bg-blue-950/20 text-[#0077b6] border border-blue-100/50 rounded"
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col">
                        <div className="flex-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase block mb-2 tracking-widest text-[#0077b6]">Surgical Management / Procedure</span>
                            <div className="space-y-2">
                                <CustomSearchableDropdown
                                    value={COMMON_PROCEDURES.includes(patient.surgicalProcedure || '') ? patient.surgicalProcedure : "Manual"}
                                    onChange={(val) => {
                                        if (val !== "Manual") {
                                            updatePatient(patient.id, { surgicalProcedure: val });
                                        }
                                    }}
                                    placeholder="Planned surgery..."
                                    options={[
                                        ...COMMON_PROCEDURES.map(p => ({ value: p, label: p })),
                                        { value: "Manual", label: "-- MANUAL PROCEDURE --" }
                                    ]}
                                />
                                <textarea 
                                    value={patient.surgicalProcedure || ''}
                                    onChange={(e) => updatePatient(patient.id, { surgicalProcedure: e.target.value })}
                                    placeholder="Describe procedure, implants, Approach, etc..."
                                    className="w-full text-xs font-medium p-3 bg-white dark:bg-slate-900 border-2 border-dashed border-[#0077b6]/20 dark:border-[#0077b6]/30 rounded-lg outline-none focus:border-[#0077b6] min-h-[85px] resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="flex items-center justify-between text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Round Summary / SOAP Note</span>
                        <span className="text-[10px] text-slate-400 font-normal italic">Click to edit note directly</span>
                    </h3>
                    <DebouncedSOAPNote 
                        initialValue={patient.soapNote || ''}
                        onSave={(val) => updatePatient(patient.id, { soapNote: val })}
                        patient={patient}
                        updatePatient={updatePatient}
                    />
                    <div className="mt-2 text-right">
                        <button 
                            onClick={() => setActiveTab('history_exam')}
                            className="text-[10px] font-bold text-[#0077b6] hover:underline flex items-center justify-end gap-1 ml-auto"
                        >
                            Detail View <Eye className="h-3 w-3" />
                        </button>
                    </div>
                </div>

                {patient.diagnosis && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/20">
                        <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5" /> Smart Suggestions for {patient.diagnosis}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {(SMART_SUGGESTIONS[patient.diagnosis as keyof typeof SMART_SUGGESTIONS] || []).map((suggestion, idx) => {
                                const exists = patient.plan.some(p => p.text === suggestion);
                                return (
                                    <button 
                                        key={idx}
                                        onClick={() => {
                                            if (!exists) {
                                                const newItem: PatientPlanItem = {
                                                    id: `p-${Date.now()}-${idx}`,
                                                    text: suggestion,
                                                    status: 'pending'
                                                };
                                                updatePatient(patient.id, { plan: [...patient.plan, newItem] });
                                            }
                                        }}
                                        disabled={exists}
                                        className={`text-[10px] px-2 py-1 rounded-md border transition-all flex items-center gap-1.5
                                            ${exists 
                                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                                                : 'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm'
                                            }`}
                                    >
                                        <Plus className="h-3 w-3" /> {suggestion}
                                    </button>
                                );
                            })}
                            {(SMART_SUGGESTIONS[patient.diagnosis as keyof typeof SMART_SUGGESTIONS] || []).length === 0 && (
                                <p className="text-[10px] text-slate-400 italic">No specific suggestions for this diagnosis yet.</p>
                            )}
                        </div>
                    </div>
                )}

                {patient.status.toLowerCase().includes('pre-op') && (
                    <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-4 border border-orange-100 dark:border-orange-900/20">
                        <h4 className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <ClipboardList className="h-3.5 w-3.5" /> Pre-Operative Checklist
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {PRE_OP_CHECKLIST.map(item => {
                                const isChecked = patient.preOpChecklist?.includes(item);
                                return (
                                    <button 
                                        key={item}
                                        onClick={() => {
                                            const current = patient.preOpChecklist || [];
                                            const next = isChecked 
                                                ? current.filter(i => i !== item)
                                                : [...current, item];
                                            updatePatient(patient.id, { preOpChecklist: next });
                                        }}
                                        className={`text-[10px] p-2 rounded-lg border text-left flex items-center gap-2 transition-all
                                            ${isChecked 
                                                ? 'bg-orange-100 border-orange-200 text-orange-800' 
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-orange-200'
                                            }`}
                                    >
                                        {isChecked ? <CheckCircle className="h-3.5 w-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                                        {item}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-4 pt-3 border-t border-orange-100 dark:border-orange-900/40 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-orange-600">
                                Completion: {Math.round(((patient.preOpChecklist?.length || 0) / PRE_OP_CHECKLIST.length) * 100)}%
                            </span>
                            <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-orange-500" 
                                    style={{ width: `${((patient.preOpChecklist?.length || 0) / PRE_OP_CHECKLIST.length) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/20">
                        <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Plus className="h-3.5 w-3.5" /> Admission Checklist
                        </h4>
                        <div className="space-y-1.5">
                            {ADMISSION_CHECKLIST.map(item => {
                                const isChecked = patient.admissionChecklist?.includes(item);
                                return (
                                    <button 
                                        key={item}
                                        onClick={() => {
                                            const current = patient.admissionChecklist || [];
                                            const next = isChecked ? current.filter(i => i !== item) : [...current, item];
                                            updatePatient(patient.id, { admissionChecklist: next });
                                        }}
                                        className="w-full flex items-center gap-2 text-[10px]"
                                    >
                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors
                                            ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                                            {isChecked && <CheckCircle className="h-2.5 w-2.5" />}
                                        </div>
                                        <span className={isChecked ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}>{item}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/20">
                        <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <History className="h-3.5 w-3.5" /> Morning Rounds Check
                        </h4>
                        <div className="space-y-1.5">
                            {MORNING_PROGRESS_ITEMS.map(item => {
                                const isChecked = patient.morningProgress?.includes(item);
                                return (
                                    <button 
                                        key={item}
                                        onClick={() => {
                                            const current = patient.morningProgress || [];
                                            const next = isChecked ? current.filter(i => i !== item) : [...current, item];
                                            updatePatient(patient.id, { morningProgress: next });
                                        }}
                                        className="w-full flex items-center gap-2 text-[10px]"
                                    >
                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors
                                            ${isChecked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                            {isChecked && <CheckCircle className="h-2.5 w-2.5" />}
                                        </div>
                                        <span className={isChecked ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}>{item}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-red-50 dark:bg-amber-900/10 rounded-xl p-4 border border-red-100 dark:border-amber-900/20">
                        <h4 className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 animate-bounce" /> Danger Signs / Red Flags
                        </h4>
                        <div className="grid grid-cols-1 gap-1 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                            {DANGER_SIGNS.map(sign => {
                                const isChecked = patient.dangerSigns?.includes(sign);
                                return (
                                    <button 
                                        key={sign}
                                        onClick={() => {
                                            const current = patient.dangerSigns || [];
                                            const next = isChecked ? current.filter(i => i !== sign) : [...current, sign];
                                            updatePatient(patient.id, { dangerSigns: next });
                                        }}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-[10px] border transition-all
                                            ${isChecked 
                                                ? 'bg-red-500 border-red-500 text-white font-bold' 
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-red-300'
                                            }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${isChecked ? 'bg-white' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                        {sign}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/20">
                        <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Plus className="h-3.5 w-3.5" /> Special Senior Advice
                        </h4>
                        <textarea 
                            value={patient.specialAdvice || ''}
                            onChange={(e) => updatePatient(patient.id, { specialAdvice: e.target.value })}
                            placeholder="Type special instructions or consultant advice here..."
                            className="w-full text-xs text-slate-700 dark:text-slate-300 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 min-h-[120px] resize-none leading-relaxed"
                        />
                    </div>
                </div>

            </div>
            <div className="space-y-6">
                {/* Active Nurse Handover Card */}
                <div className="bg-[#0077b6]/5 dark:bg-[#0077b6]/10 border border-[#0077b6]/20 dark:border-[#0077b6]/30 rounded-xl p-4 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1.5 opacity-20 group-hover:opacity-40 transition-opacity">
                        <Sparkles className="h-10 w-10 text-[#0077b6]" />
                    </div>
                    <h4 className="text-[10px] font-black text-[#0077b6] dark:text-sky-400 uppercase tracking-widest mb-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" /> Shift Handover / Nursing Instructions
                        </span>
                        <button 
                            onClick={() => openQuickMenu('handover', patient)}
                            className="text-[10px] px-2 py-0.5 bg-white dark:bg-slate-800 text-[#0077b6] hover:bg-[#0077b6]/10 border border-[#0077b6]/20 rounded-md transition-all font-bold shadow-sm"
                        >
                            Update
                        </button>
                    </h4>
                    {patient.nurseHandover ? (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                                {patient.nurseHandover}
                            </p>
                            {patient.nurseHandovers && patient.nurseHandovers.length > 0 && (
                                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-medium flex justify-between items-center">
                                    <span>Last updated: {new Date(patient.nurseHandovers[0].date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} by {patient.nurseHandovers[0].addedBy}</span>
                                    <button 
                                        onClick={() => openQuickMenu('handover', patient)}
                                        className="underline hover:text-slate-400 hover:underline transition-colors cursor-pointer"
                                    >
                                        History ({patient.nurseHandovers.length})
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-4 text-center">
                            <p className="text-xs text-slate-400 italic">No shift handover instructions recorded.</p>
                            <button 
                                onClick={() => openQuickMenu('handover', patient)}
                                className="mt-2.5 text-[10px] bg-[#0077b6] text-white px-3 py-1.5 rounded-lg hover:bg-[#005f92] transition-colors font-bold shadow-sm"
                            >
                                Record Handover Note
                            </button>
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">
                        <Activity className="h-4 w-4" /> Vitals Monitor
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <VitalField 
                            label="Blood Pressure"
                            value={patient.physicalExam?.vitals?.bp || ''}
                            unit="mmHg"
                            onChange={(e) => updatePhysicalExam(patient.id, { vitals: { ...(patient.physicalExam?.vitals as any), bp: e.target.value } })}
                        />
                        <VitalField 
                            label="Pulse Rate"
                            value={patient.physicalExam?.vitals?.pulse || ''}
                            unit="bpm"
                            type="number"
                            onChange={(e) => updatePhysicalExam(patient.id, { vitals: { ...(patient.physicalExam?.vitals as any), pulse: parseInt(e.target.value) || 0 } })}
                        />
                        <VitalField 
                            label="Oxygen Saturation"
                            value={patient.physicalExam?.vitals?.spo2 || ''}
                            unit="%"
                            type="number"
                            onChange={(e) => updatePhysicalExam(patient.id, { vitals: { ...(patient.physicalExam?.vitals as any), spo2: parseInt(e.target.value) || 0 } })}
                        />
                        <VitalField 
                            label="Temperature"
                            value={patient.physicalExam?.vitals?.temp || ''}
                            unit="°F"
                            type="number"
                            step="0.1"
                            onChange={(e) => updatePhysicalExam(patient.id, { vitals: { ...(patient.physicalExam?.vitals as any), temp: parseFloat(e.target.value) || 0 } })}
                        />
                    </div>
                </div>
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">
                        Patient Status
                    </h3>
                    <div className="w-full">
                        <CustomSearchableDropdown
                            value={patient.status}
                            onChange={(val) => updatePatient(patient.id, { status: val })}
                            options={PATIENT_STATUSES.map(s => ({ value: s, label: s }))}
                            searchable={false}
                        />
                    </div>
                </div>

                {(() => {
                    const qCategory = patient.quickNotesCategory || 'General';
                    const qContainerStyles = 
                        qCategory === 'Urgent' 
                            ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20 dark:border-rose-500/30' 
                            : qCategory === 'Routine'
                            ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 dark:border-amber-500/30'
                            : 'bg-sky-500/5 dark:bg-sky-500/10 border-sky-500/20 dark:border-sky-500/30';

                    const qTitleStyles = 
                        qCategory === 'Urgent' 
                            ? 'text-rose-600 dark:text-rose-400 font-extrabold' 
                            : qCategory === 'Routine'
                            ? 'text-amber-600 dark:text-amber-400 font-extrabold'
                            : 'text-sky-655 dark:text-sky-400 font-extrabold';

                    const qIconColor = 
                        qCategory === 'Urgent' 
                            ? 'text-rose-500' 
                            : qCategory === 'Routine'
                            ? 'text-amber-500'
                            : 'text-sky-500';

                    return (
                        <div className={`${qContainerStyles} border rounded-xl p-4 shadow-sm space-y-3 transition-colors duration-300`}>
                            <h4 className={`text-[10px] uppercase tracking-widest flex items-center justify-between`}>
                                <div className={`flex items-center gap-1.5 ${qTitleStyles}`}>
                                    <FileText className={`h-4 w-4 ${qIconColor}`} /> Temporary Quick Notes
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {patient.quickNotes && patient.quickNotes.trim().length > 0 && (
                                        <button 
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await navigator.clipboard.writeText(patient.quickNotes || '');
                                                    setHeaderCopied(true);
                                                    setTimeout(() => setHeaderCopied(false), 2000);
                                                } catch (err) {
                                                    console.error('Failed to copy: ', err);
                                                }
                                            }}
                                            className={`p-1 rounded transition-all cursor-pointer flex items-center justify-center border ${
                                                qCategory === 'Urgent'
                                                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 border-rose-200/40 dark:border-rose-900/40'
                                                    : qCategory === 'Routine'
                                                    ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 border-amber-200/40 dark:border-amber-900/40'
                                                    : 'text-sky-600 dark:text-sky-400 hover:bg-sky-100/60 dark:hover:bg-sky-950/40 border-sky-200/40 dark:border-sky-900/40'
                                            }`}
                                            title="Copy Quick Notes to clipboard"
                                        >
                                            {headerCopied ? (
                                                <CheckCircle className="h-3 w-3 text-emerald-500 animate-pulse" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </button>
                                    )}
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        qCategory === 'Urgent' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' :
                                        qCategory === 'Routine' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                                        'bg-sky-100 text-sky-700 dark:bg-sky-950/45 dark:text-sky-300'
                                    }`}>
                                        {qCategory.toUpperCase()}
                                    </span>
                                </div>
                            </h4>
                            <DebouncedQuickNotes 
                                initialValue={patient.quickNotes || ''}
                                onSave={(val) => updatePatient(patient.id, { quickNotes: val })}
                                currentCategory={patient.quickNotesCategory || 'General'}
                                onChangeCategory={(cat) => updatePatient(patient.id, { quickNotesCategory: cat })}
                            />
                        </div>
                    );
                })()}
            </div>
        </div>
        </div>
    );

    const updatePatient = (patientId: string, updates: Partial<OrthoPatient>) => {
        setPatients(prev => prev.map(p => p.id === patientId ? { ...p, ...updates } : p));
    };

    const updateDemographics = (patientId: string, updates: Partial<OrthoPatient['demographics']>) => {
        setPatients(prev => prev.map(p => p.id === patientId ? { 
            ...p, 
            demographics: { ...p.demographics, ...updates } 
        } : p));
    };

    const renderDemographics = (patient: OrthoPatient) => (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Users className="h-5 w-5 text-[#0077b6]" />
                Demographics Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Full Name</label>
                        <input 
                            type="text"
                            value={patient.demographics.name}
                            onChange={(e) => updateDemographics(patient.id, { name: e.target.value })}
                            className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Age</label>
                            <input 
                                type="number"
                                value={patient.demographics.age}
                                onChange={(e) => updateDemographics(patient.id, { age: parseInt(e.target.value) || 0 })}
                                className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Sex</label>
                            <CustomSearchableDropdown
                                value={patient.demographics.sex}
                                onChange={(val) => updateDemographics(patient.id, { sex: val as any })}
                                options={[
                                    { value: "M", label: "Male" },
                                    { value: "F", label: "Female" },
                                    { value: "Other", label: "Other" }
                                ]}
                                searchable={false}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Mobile Number
                        </label>
                        <input 
                            type="text"
                            value={patient.demographics.mobile}
                            onChange={(e) => updateDemographics(patient.id, { mobile: e.target.value })}
                            placeholder="+977..."
                            className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                        />
                    </div>
                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-3 gap-4">
                            <label className="text-xs font-bold text-slate-400 uppercase shrink-0">Comorbidities</label>
                            <div className="w-48">
                                <CustomSearchableDropdown
                                    value=""
                                    placeholder="Quick Add..."
                                    onChange={(val) => {
                                        if (val) {
                                            const current = patient.comorbidities || [];
                                            if (!current.includes(val)) {
                                                updatePatient(patient.id, { comorbidities: [...current, val] });
                                            }
                                        }
                                    }}
                                    options={COMORBIDITIES.map(c => ({ value: c, label: c }))}
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(patient.comorbidities || []).map(c => (
                                <span key={c} className="px-2.5 py-1 bg-[#0077b6] text-white text-[11px] font-semibold rounded-md flex items-center gap-1.5 shadow-sm">
                                    {c}
                                    <button 
                                        onClick={() => updatePatient(patient.id, { comorbidities: patient.comorbidities?.filter(dc => dc !== c) })}
                                        className="hover:text-red-300 transition-colors bg-white/20 rounded p-0.5"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                            {(!patient.comorbidities || patient.comorbidities.length === 0) && (
                                <span className="text-xs text-slate-400 italic">No comorbidities added</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Bed Number</label>
                        <input 
                            type="text"
                            value={patient.demographics.bedNumber}
                            onChange={(e) => updateDemographics(patient.id, { bedNumber: e.target.value })}
                            className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Rank</label>
                            <input 
                                type="text"
                                value={patient.demographics.rank || ''}
                                onChange={(e) => updateDemographics(patient.id, { rank: e.target.value })}
                                placeholder="e.g. Sepoy, Major"
                                className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Unit</label>
                            <input 
                                type="text"
                                value={patient.demographics.unit || ''}
                                onChange={(e) => updateDemographics(patient.id, { unit: e.target.value })}
                                placeholder="e.g. Unit-I"
                                className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Computer No</label>
                            <input 
                                type="text"
                                value={patient.demographics.computerNo || ''}
                                onChange={(e) => updateDemographics(patient.id, { computerNo: e.target.value })}
                                className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block flex items-center gap-1">
                                <CreditCard className="h-3 w-3" /> Hospital ID (SBH No.)
                            </label>
                            <input 
                                type="text"
                                value={patient.demographics.sbhNumber}
                                onChange={(e) => updateDemographics(patient.id, { sbhNumber: e.target.value })}
                                className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block flex items-center gap-1">
                                <Search className="h-3 w-3" /> Address
                            </label>
                            <input 
                                type="text"
                                value={patient.demographics.address || ''}
                                onChange={(e) => updateDemographics(patient.id, { address: e.target.value })}
                                className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Admission Date
                            </label>
                            <input 
                                type="date"
                                value={patient.demographics.admissionDate || ''}
                                onChange={(e) => updateDemographics(patient.id, { admissionDate: e.target.value })}
                                className="w-full text-slate-900 dark:text-white font-medium p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] transition-all"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Encounter Source</label>
                            <CustomSearchableDropdown
                                value={patient.demographics.encounterSource || 'OPD'}
                                onChange={(val) => updateDemographics(patient.id, { encounterSource: val })}
                                options={[
                                    { value: 'OPD', label: 'OPD (Outpatient Dept)' },
                                    { value: 'Emergency', label: 'Emergency (ER)' },
                                    { value: 'Referral', label: 'Referral' },
                                    { value: 'Take-over', label: 'Take-over' },
                                    { value: 'Department transfer', label: 'Department transfer' },
                                    { value: 'Post-operative transfer', label: 'Post-operative transfer' }
                                ]}
                                searchable={false}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Admission Category</label>
                            <CustomSearchableDropdown
                                value={patient.demographics.admissionCategory || 'Routine'}
                                onChange={(val) => updateDemographics(patient.id, { admissionCategory: val })}
                                options={[
                                    { value: 'Routine', label: 'Routine / Elective' },
                                    { value: 'Urgent', label: 'Urgent' },
                                    { value: 'Emergency', label: 'Emergency Admission' }
                                ]}
                                searchable={false}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Orthopedic Diagnosis & Management</label>
                        <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Primary Diagnosis</label>
                                <CustomSearchableDropdown
                                    value={patient.diagnosis}
                                    onChange={(val) => updatePatient(patient.id, { diagnosis: val })}
                                    placeholder="Select a diagnosis..."
                                    options={ORTHO_DIAGNOSES.map(d => ({ value: d, label: d }))}
                                />
                                <input 
                                    type="text"
                                    value={patient.diagnosis}
                                    onChange={(e) => updatePatient(patient.id, { diagnosis: e.target.value })}
                                    placeholder="Type specific diagnosis if not listed..."
                                    className="mt-2 w-full text-xs text-slate-600 dark:text-slate-400 p-2 bg-transparent border-b border-slate-200 dark:border-slate-700 outline-none focus:border-[#0077b6] italic"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Mechanism of Injury (MOI)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {MOI_OPTIONS.map(opt => {
                                            const isSelected = patient.moi === opt || (opt === "Other" && patient.moi?.startsWith("Other:"));
                                            return (
                                                <button
                                                    key={opt}
                                                    onClick={() => updatePatient(patient.id, { moi: opt === 'Other' ? 'Other: ' : opt })}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${isSelected ? 'bg-[#0077b6] text-white border-[#0077b6] shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#0077b6]/50'}`}
                                                >
                                                    {opt.replace(' (Road Traffic Accident)', '')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {patient.moi?.startsWith("Other:") && (
                                        <input 
                                            type="text"
                                            value={patient.moi.startsWith("Other: ") ? patient.moi.replace("Other: ", "") : patient.moi.replace("Other:", "")}
                                            placeholder="Type custom MOI..."
                                            onChange={(e) => updatePatient(patient.id, { moi: "Other: " + e.target.value })}
                                            className="w-full mt-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6]"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Injury Date</label>
                                    <input
                                        type="date"
                                        value={patient.injuryDate || ''}
                                        onChange={(e) => updatePatient(patient.id, { injuryDate: e.target.value })}
                                        className="w-full text-xs font-bold text-slate-900 dark:text-white p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Injury Time</label>
                                    <input
                                        type="time"
                                        value={patient.injuryTime || ''}
                                        onChange={(e) => updatePatient(patient.id, { injuryTime: e.target.value })}
                                        className="w-full text-xs font-bold text-slate-900 dark:text-white p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Classification</label>
                                    <div className="flex flex-wrap gap-2">
                                        {ORTHO_CLASSIFICATIONS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => updatePatient(patient.id, { classification: c })}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${patient.classification === c ? 'bg-[#0077b6] text-white border-[#0077b6] shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#0077b6]/50'}`}
                                            >
                                                {c.split(' (')[0]}
                                            </button>
                                        ))}
                                    </div>
                                    {patient.classification && !ORTHO_CLASSIFICATIONS.includes(patient.classification) && (
                                        <input 
                                            type="text"
                                            value={patient.classification}
                                            onChange={(e) => updatePatient(patient.id, { classification: e.target.value })}
                                            placeholder="Type custom classification..."
                                            className="w-full mt-3 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6]"
                                        />
                                    )}
                                </div>
                                <div className="md:w-1/2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Type/Grade</label>
                                    <input 
                                        type="text"
                                        value={patient.fractureType || ''}
                                        onChange={(e) => updatePatient(patient.id, { fractureType: e.target.value })}
                                        placeholder="e.g. 32-A3 or Type IIIA"
                                        className="w-full text-xs font-bold text-slate-900 dark:text-white p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Procedure Planned/Performed</label>
                                <CustomSearchableDropdown
                                    value={patient.surgicalProcedure || ''}
                                    onChange={(val) => updatePatient(patient.id, { surgicalProcedure: val })}
                                    placeholder="Select procedure..."
                                    options={COMMON_PROCEDURES.map(p => ({ value: p, label: p }))}
                                />
                                <input 
                                    type="text"
                                    value={patient.surgicalProcedure || ''}
                                    onChange={(e) => updatePatient(patient.id, { surgicalProcedure: e.target.value })}
                                    placeholder="Or type manual procedure details..."
                                    className="mt-2 w-full text-xs text-slate-600 dark:text-slate-400 p-2 bg-transparent border-b border-slate-200 dark:border-slate-700 outline-none focus:border-[#0077b6] italic"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 italic">
                    All changes are saved automatically. You can also update these fields by dictating notes in the AI Smart Entry box.
                </p>
            </div>
        </div>
    );

    const updateHistory = (patientId: string, updates: Partial<OrthoHistory>) => {
        setPatients(prev => prev.map(p => {
            if (p.id !== patientId) return p;
            const history = p.history || { 
                chiefComplaint: '', hpi: '', pmh: '', psh: '', 
                medications: '', allergies: '', socialHistory: '' 
            };
            return { ...p, history: { ...history, ...updates } };
        }));
    };

    const updatePhysicalExam = (patientId: string, updates: Partial<OrthoPhysicalExam>) => {
        setPatients(prev => prev.map(p => {
            if (p.id !== patientId) return p;
            const physicalExam = p.physicalExam || { 
                general: '', 
                localExam: { inspection: '', palpation: '', movements: '', neurovascular: '' } 
            };
            return { ...p, physicalExam: { ...physicalExam, ...updates } };
        }));
    };

    const updateLocalExam = (patientId: string, updates: Partial<OrthoPhysicalExam['localExam']>) => {
        setPatients(prev => prev.map(p => {
            if (p.id !== patientId) return p;
            
            const physicalExam = p.physicalExam || { 
                general: '', 
                localExam: { inspection: '', palpation: '', movements: '', neurovascular: '' } 
            };
            
            return {
                ...p,
                physicalExam: {
                    ...physicalExam,
                    localExam: { ...(physicalExam.localExam || {}), ...updates }
                }
            };
        }));
    };

    const handleSystemClick = (patient: OrthoPatient, key: string) => {
        setSelectedBodySystem(key);
        setActiveAdditionalOp(null);
        
        const exam = patient.physicalExam?.bodySystems?.[key];
        setBodySystemNotes(exam?.notes || '');
        setBodySystemStatus(exam?.status || 'Not Examined');
    };

    const handleSaveSystemNotes = (patientId: string, systemKey: string) => {
        setPatients(prev => prev.map(p => {
            if (p.id !== patientId) return p;
            const physicalExam = p.physicalExam || { 
                general: '', 
                localExam: { inspection: '', palpation: '', movements: '', neurovascular: '' } 
            };
            const bodySystems = physicalExam.bodySystems || {};
            return {
                ...p,
                physicalExam: {
                    ...physicalExam,
                    bodySystems: {
                        ...bodySystems,
                        [systemKey]: { status: bodySystemStatus, notes: bodySystemNotes }
                    }
                }
            };
        }));
    };

    const updateQuestionnaireItem = (patientId: string, itemId: string, checked: boolean) => {
        setPatients(prev => prev.map(p => {
            if (p.id !== patientId) return p;
            const physicalExam = p.physicalExam || { 
                general: '', 
                localExam: { inspection: '', palpation: '', movements: '', neurovascular: '' } 
            };
            const currentQ = physicalExam.medicalQuestionnaire || [
                { id: 'q1', question: 'Cardiopulmonary history or previous anesthesia complications?', checked: false },
                { id: 'q2', question: 'Ongoing anticoagulant therapy (Aspirin, Warfarin, LMWH, etc.)?', checked: false },
                { id: 'q3', question: 'Known severe drug allergies (Penicillin, NSAIDs, Sulfa, etc.)?', checked: false },
                { id: 'q4', question: 'Family history of bleeding disorders / hemophilia?', checked: false },
                { id: 'q5', question: 'Long-term medication / corticosteroids use?', checked: false },
                { id: 'q6', question: 'Recent respiratory infections, cough, or fever?', checked: false }
            ];
            const medicalQuestionnaire = currentQ.map(q => q.id === itemId ? { ...q, checked } : q);
            return {
                ...p,
                physicalExam: {
                    ...physicalExam,
                    medicalQuestionnaire
                }
            };
        }));
    };

    const updateInvestigations = (patientId: string, updates: Partial<OrthoPatient['investigations']>) => {
        setPatients(prev => prev.map(p => p.id === patientId ? { 
            ...p, 
            investigations: { ...p.investigations, ...updates } 
        } : p));
    };

    const renderHistoryExam = (patient: OrthoPatient) => (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <History className="h-5 w-5 text-[#0077b6]" />
                    Clinical History
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Chief Complaint</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {['Pain', 'Swelling', 'Deformity', 'Stiffness', 'Instability', 'Wound Discharge', 'Bleeding', 'Inability to bear weight'].map(pills => (
                                <button
                                    key={pills}
                                    onClick={() => {
                                        const curr = patient.history?.chiefComplaint || '';
                                        const val = curr ? curr + ', ' + pills : pills;
                                        updateHistory(patient.id, { chiefComplaint: val });
                                    }}
                                    className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 hover:bg-[#0077b6]/10 hover:text-[#0077b6] text-slate-600 rounded transition-all cursor-pointer border border-slate-200/50"
                                >
                                    + {pills}
                                </button>
                            ))}
                        </div>
                        <textarea 
                            value={patient.history?.chiefComplaint || ''}
                            onChange={(e) => updateHistory(patient.id, { chiefComplaint: e.target.value })}
                            placeholder="e.g. Pain and deformity in L thigh..."
                            className="w-full text-sm text-slate-800 dark:text-slate-200 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[60px] resize-y"
                        />
                    </div>

                    {/* SOCRATES Pain Assessment Form */}
                    {/(pain|hurt|ache)/i.test(patient.history?.chiefComplaint || '') && (
                        <div className="bg-blue-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-blue-100 dark:border-slate-800 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="h-4 w-4 text-[#0077b6]" />
                                <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider font-mono">
                                    SOCRATES Pain Assessment (Clinical Protocol)
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Site (Exact Location)</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Rt distal tibia"
                                        value={patient.history?.socratesSite || ''}
                                        onChange={(e) => updateHistory(patient.id, { socratesSite: e.target.value })}
                                        className="w-full text-xs text-slate-800 dark:text-slate-200 p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Onset (When / How?)</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Sudden post-fall"
                                        value={patient.history?.socratesOnset || ''}
                                        onChange={(e) => updateHistory(patient.id, { socratesOnset: e.target.value })}
                                        className="w-full text-xs text-slate-800 dark:text-slate-200 p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Character (Type)</label>
                                    <CustomSearchableDropdown
                                        value={patient.history?.socratesCharacter || 'Sharp'}
                                        onChange={(val) => updateHistory(patient.id, { socratesCharacter: val })}
                                        options={[
                                            { value: 'Sharp', label: 'Sharp / stabbing' },
                                            { value: 'Dull', label: 'Dull aching' },
                                            { value: 'Burning', label: 'Burning' },
                                            { value: 'Throbbing', label: 'Throbbing' },
                                            { value: 'Crushing', label: 'Crushing' }
                                        ]}
                                        searchable={false}
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Radiation (Spreads?)</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. No radiation, stays in knee"
                                        value={patient.history?.socratesRadiation || ''}
                                        onChange={(e) => updateHistory(patient.id, { socratesRadiation: e.target.value })}
                                        className="w-full text-xs text-slate-800 dark:text-slate-200 p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Associations (Symptoms)</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Numbness in foot"
                                        value={patient.history?.socratesAssociations || ''}
                                        onChange={(e) => updateHistory(patient.id, { socratesAssociations: e.target.value })}
                                        className="w-full text-xs text-slate-800 dark:text-slate-200 p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Timing (Pattern)</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Worse at night"
                                        value={patient.history?.socratesTiming || ''}
                                        onChange={(e) => updateHistory(patient.id, { socratesTiming: e.target.value })}
                                        className="w-full text-xs text-slate-800 dark:text-slate-200 p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Exacerbating/Relieving</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Worse on weight-bearing"
                                        value={patient.history?.socratesExacerbating || ''}
                                        onChange={(e) => updateHistory(patient.id, { socratesExacerbating: e.target.value })}
                                        className="w-full text-xs text-slate-800 dark:text-slate-200 p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Severity (Pain Score: {patient.history?.socratesSeverity || 5}/10)</label>
                                    <input 
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={patient.history?.socratesSeverity || 5}
                                        onChange={(e) => updateHistory(patient.id, { socratesSeverity: parseInt(e.target.value) || 5 })}
                                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0077b6]"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">History of Presenting Illness</label>
                        <textarea 
                            value={patient.history?.hpi || ''}
                            onChange={(e) => updateHistory(patient.id, { hpi: e.target.value })}
                            placeholder="Details of accident, onset, severity..."
                            className="w-full text-sm text-slate-800 dark:text-slate-200 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[120px] resize-y"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Past Medical History</label>
                            <textarea 
                                value={patient.history?.pmh || ''}
                                onChange={(e) => updateHistory(patient.id, { pmh: e.target.value })}
                                placeholder="Co-morbidities like HTN, DM..."
                                className="w-full text-sm text-slate-800 dark:text-slate-200 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[60px] resize-y"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Past Surgical History</label>
                            <textarea 
                                value={patient.history?.psh || ''}
                                onChange={(e) => updateHistory(patient.id, { psh: e.target.value })}
                                placeholder="Previous surgeries..."
                                className="w-full text-sm text-slate-800 dark:text-slate-200 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[60px] resize-y"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Body Systems & Review of Systems Section */}
            <div className="bg-[#f0f4f8] dark:bg-slate-950 p-5 rounded-xl border border-blue-200 dark:border-blue-900/60 shadow-md flex flex-col gap-4 text-slate-800 dark:text-slate-200">
                {/* Header mimicking the deep blue banner */}
                <div className="bg-[#0c2340] text-white px-5 py-3 rounded-lg flex items-center justify-between border-b border-[#0f1f33] shadow-md">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-sky-400 animate-pulse" />
                        <h3 className="text-sm md:text-base font-bold uppercase tracking-wider font-sans">
                            Body Systems
                        </h3>
                    </div>
                    <span className="text-[10px] font-mono text-sky-300 font-semibold bg-sky-950 px-2 py-0.5 rounded border border-sky-800/55">
                        Interactive Review
                    </span>
                </div>

                {/* Sub-cards: left block and right block */}
                <div className="flex flex-col lg:flex-row gap-5">
                    {/* Left Card: Examinations */}
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden">
                        {/* Title Bar */}
                        <div className="bg-[#3a75c4] text-white py-2 px-4 text-xs font-bold text-center uppercase tracking-wider">
                            Examinations
                        </div>

                        {/* 3x5 Grid of Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-900/40">
                            {BODY_SYSTEMS_LIST.map((sys) => {
                                const examData = patient.physicalExam?.bodySystems?.[sys.key];
                                const isExamined = examData?.status === 'Examined' || examData?.status === 'Abnormal';
                                const isAbnormal = examData?.status === 'Abnormal';
                                const isSelected = selectedBodySystem === sys.key;

                                // Determine background colors based on status & selection
                                let bgClass = 'bg-[#1e88e5] text-white hover:bg-[#1570b8] border-[#1e88e5]/20';
                                if (isSelected || isAbnormal) {
                                    bgClass = 'bg-[#e07a22] text-white hover:bg-[#c9691b] border-[#e07a22]/20';
                                } else if (examData?.status === 'Examined') {
                                    bgClass = 'bg-[#1565c0] text-white hover:bg-[#0d47a1] border-[#1565c0]/20';
                                }

                                return (
                                    <button
                                        key={sys.key}
                                        onClick={() => handleSystemClick(patient, sys.key)}
                                        className={`h-14 relative rounded flex items-center justify-center p-2 text-center text-[11px] font-black uppercase tracking-tight transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-xs border ${bgClass}`}
                                    >
                                        <span className="relative z-10">{sys.label}</span>

                                        {/* Small Checkbox exactly placed in bottom left corner as seen in ENMT orange button */}
                                        <div className="absolute bottom-1 right-1 h-3.5 w-3.5 bg-white border border-stone-400 flex items-center justify-center">
                                            {isExamined && (
                                                <div className="h-1.5 w-1.5 bg-[#4e3629]" /> // a small square/ticked representation mimicking the image exactly
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Card: Additional Options */}
                    <div className="w-full lg:w-64 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden">
                        {/* Title Bar */}
                        <div className="bg-[#3a75c4] text-white py-2 px-4 text-xs font-bold text-center uppercase tracking-wider">
                            Additional Op...
                        </div>

                        <div className="p-4 flex flex-col gap-4 flex-1 justify-center bg-slate-50 dark:bg-slate-900/40">
                            {/* PFSH Box */}
                            <button
                                onClick={() => {
                                    setActiveAdditionalOp(activeAdditionalOp === 'pfsh' ? null : 'pfsh');
                                    setSelectedBodySystem(null);
                                }}
                                className={`h-24 rounded flex flex-col items-center justify-center gap-1 shadow-sm transition-all duration-150 cursor-pointer border active:scale-[0.98] text-white
                                    ${activeAdditionalOp === 'pfsh'
                                        ? 'bg-[#2e7d32] border-[#2e7d32]/20 hover:bg-[#1b5e20]'
                                        : 'bg-[#4caf50] border-[#4caf50]/20 hover:bg-[#3d9140]'}`}
                            >
                                <Users className="h-7 w-7" />
                                <span className="text-base font-black tracking-wider font-sans">PFSH</span>
                            </button>

                            {/* Medical Questionnaire Box */}
                            <button
                                onClick={() => {
                                    setActiveAdditionalOp(activeAdditionalOp === 'questionnaire' ? null : 'questionnaire');
                                    setSelectedBodySystem(null);
                                }}
                                className={`h-24 rounded flex flex-col items-center justify-center gap-1 shadow-sm transition-all duration-150 cursor-pointer border active:scale-[0.98] text-white
                                    ${activeAdditionalOp === 'questionnaire'
                                        ? 'bg-[#5e35b1] border-[#5e35b1]/20 hover:bg-[#4527a0]'
                                        : 'bg-[#7a58bf] border-[#7a58bf]/20 hover:bg-[#6c48b0]'}`}
                            >
                                <ClipboardList className="h-7 w-7" />
                                <span className="text-[11px] font-black tracking-tight font-sans text-center px-1">
                                    Medical Questionnaire
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-Editors block: Expands on selection */}
                <AnimatePresence mode="wait">
                    {selectedBodySystem && (() => {
                        const currentSys = BODY_SYSTEMS_LIST.find(s => s.key === selectedBodySystem);
                        if (!currentSys) return null;
                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-lg p-5 shadow-sm space-y-4"
                            >
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-[#3a75c4]/15 p-2 rounded-lg">
                                            <Stethoscope className="h-5 w-5 text-[#3372c4]" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 dark:text-white uppercase tracking-tight">
                                                Examining: <span className="text-[#3a75c4]">{currentSys.label}</span>
                                            </h4>
                                            <p className="text-[10px] text-slate-400">Describe physical exam parameters & findings for this system</p>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setBodySystemNotes(currentSys.normalPreset);
                                            setBodySystemStatus('Examined');
                                        }}
                                        className="text-[10px] px-2.5 py-1 text-sky-700 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 font-bold rounded-md border border-sky-200 dark:border-sky-900/50 flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                        <Sparkles className="h-3 w-3" /> Insert Normal Preset
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Column 1: Status Toggle */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">System Status</label>
                                        <div className="flex flex-col gap-2">
                                            {(['Not Examined', 'Examined', 'Abnormal'] as const).map((status) => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => setBodySystemStatus(status)}
                                                    className={`px-3 py-2 text-xs font-bold rounded-lg text-left transition-all border flex items-center justify-between cursor-pointer ${
                                                        bodySystemStatus === status
                                                            ? status === 'Abnormal'
                                                                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                                                : status === 'Examined'
                                                                    ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                                                                    : 'bg-slate-600 text-white border-slate-700 shadow-xs'
                                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100/90'
                                                    }`}
                                                >
                                                    <span>{status === 'Examined' ? 'Examined (Normal)' : status}</span>
                                                    {bodySystemStatus === status && <CheckCircle className="h-4 w-4 shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Column 2 & 3: Notes Area */}
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Clinical Description</label>
                                        <textarea
                                            value={bodySystemNotes}
                                            onChange={(e) => setBodySystemNotes(e.target.value)}
                                            placeholder="Write detailed system findings, parameters, deviations..."
                                            className="w-full text-sm text-slate-800 dark:text-slate-200 dark:text-slate-100 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 outline-none focus:ring-1 focus:ring-[#3a75c4] min-h-[110px]"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedBodySystem(null)}
                                        className="px-4 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-bold rounded-lg cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleSaveSystemNotes(patient.id, currentSys.key);
                                            setSelectedBodySystem(null);
                                        }}
                                        className="px-4 py-1.5 bg-[#3a75c4] hover:bg-[#2e62a8] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                                    >
                                        <Save className="h-3.5 w-3.5" /> Save Findings
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })()}

                    {activeAdditionalOp === 'pfsh' && (
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="bg-white dark:bg-slate-900 border border-green-200 dark:border-green-950 p-5 rounded-lg shadow-sm space-y-4"
                        >
                            <div className="flex items-center justify-between border-b border-green-50 dark:border-green-900/30 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="bg-green-100 dark:bg-green-950/40 p-2 rounded-lg">
                                        <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 dark:text-white uppercase tracking-tight">
                                            PFSH: <span className="text-green-600 dark:text-green-400">Past, Family, & Social History</span>
                                        </h4>
                                        <p className="text-[10px] text-slate-400">Coordinate and verify patient baseline medical/social status</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-mono text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded border border-green-200 dark:border-green-900/50 select-none">
                                    Synced with clinical records
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Past Medical History</label>
                                    <textarea
                                        value={patient.history?.pmh || ''}
                                        onChange={(e) => updateHistory(patient.id, { pmh: e.target.value })}
                                        placeholder="Co-morbidities, chronical health conditions..."
                                        className="w-full text-xs text-slate-800 dark:text-slate-200 dark:text-slate-100 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-205 dark:border-slate-800 outline-none focus:ring-1 focus:ring-green-500 min-h-[90px]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Past Surgical History</label>
                                    <textarea
                                        value={patient.history?.psh || ''}
                                        onChange={(e) => updateHistory(patient.id, { psh: e.target.value })}
                                        placeholder="Prior surgeries, dates, complications, anesthesia reaction..."
                                        className="w-full text-xs text-slate-800 dark:text-slate-200 dark:text-slate-100 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-205 dark:border-slate-800 outline-none focus:ring-1 focus:ring-green-500 min-h-[90px]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Social History / Medications</label>
                                    <textarea
                                        value={patient.history?.socialHistory || ''}
                                        onChange={(e) => updateHistory(patient.id, { socialHistory: e.target.value })}
                                        placeholder="Smoking/alcohol, occupation, home circumstances, medications..."
                                        className="w-full text-xs text-slate-800 dark:text-slate-200 dark:text-slate-100 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-205 dark:border-slate-800 outline-none focus:ring-1 focus:ring-green-500 min-h-[90px]"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800/60">
                                <button
                                    type="button"
                                    onClick={() => setActiveAdditionalOp(null)}
                                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                                >
                                    Done / Close PFSH
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {activeAdditionalOp === 'questionnaire' && (() => {
                        const defaultQ = [
                            { id: 'q1', question: 'Cardiopulmonary history or previous anesthesia complications?', checked: false },
                            { id: 'q2', question: 'Ongoing anticoagulant therapy (Aspirin, Warfarin, LMWH, etc.)?', checked: false },
                            { id: 'q3', question: 'Known severe drug allergies (Penicillin, NSAIDs, Sulfa, etc.)?', checked: false },
                            { id: 'q4', question: 'Family history of bleeding disorders or hemophilia?', checked: false },
                            { id: 'q5', question: 'Long-term medication or corticosteroid use?', checked: false },
                            { id: 'q6', question: 'Recent respiratory infections, cough, or fever?', checked: false }
                        ];
                        const currentQ = patient.physicalExam?.medicalQuestionnaire || defaultQ;
                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-950 p-5 rounded-lg shadow-sm space-y-4"
                            >
                                <div className="flex items-center justify-between border-b border-purple-50 dark:border-purple-900/30 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-purple-100 dark:bg-purple-950/40 p-2 rounded-lg">
                                            <ClipboardList className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 dark:text-white uppercase tracking-tight">
                                                Medical Questionnaire Checklist
                                            </h4>
                                            <p className="text-[10px] text-slate-400">Pre-Op Safety Audit & PAC Anesthesia Readiness Screener</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            defaultQ.forEach(q => updateQuestionnaireItem(patient.id, q.id, false));
                                        }}
                                        className="text-[9px] hover:underline text-purple-600 font-bold capitalize transition-colors cursor-pointer"
                                    >
                                        Clear all answers
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {currentQ.map((q) => (
                                        <div 
                                            key={q.id} 
                                            onClick={() => updateQuestionnaireItem(patient.id, q.id, !q.checked)}
                                            className={`p-3 border rounded-lg flex items-start gap-3 cursor-pointer select-none transition-all ${
                                                q.checked 
                                                    ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/50' 
                                                    : 'bg-slate-50 hover:bg-slate-100/85 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                                            }`}
                                        >
                                            <input 
                                                type="checkbox"
                                                checked={q.checked}
                                                readOnly
                                                className="mt-0.5 h-4 w-4 text-purple-600 border-slate-300 dark:border-slate-700 rounded focus:ring-purple-500"
                                            />
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                                                {q.question}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400 italic">
                                    <span>* Ticked items flag alert conditions.</span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveAdditionalOp(null)}
                                        className="px-4 py-1.5 bg-[#7a58bf] hover:bg-[#6543ab] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
                                    >
                                        Done / Close Questionnaire
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Stethoscope className="h-5 w-5 text-[#0077b6]" />
                        Orthopedic Examination
                    </h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => updateLocalExam(patient.id, { neurovascular: 'Distal neurovascular status intact. Pulses +, Sensation normal.' })}
                            className="text-[10px] font-bold px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded hover:bg-green-100 transition-colors"
                        >
                            Sync NV Normal
                        </button>
                    </div>
                </div>
                <div className="space-y-6">
                    {/* General Examination Checklist */}
                    <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                            📋 General Physical Examination Checklist
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {[
                                { key: 'gc', label: 'GC Fair/Stable' },
                                { key: 'ill', label: 'Ill-looking / Toxic' },
                                { key: 'conscious', label: 'Conscious & Oriented' },
                                { key: 'pallor', label: 'No Pallor' },
                                { key: 'icterus', label: 'No Icterus' },
                                { key: 'cyanosis', label: 'No Cyanosis' },
                                { key: 'clubbing', label: 'No Clubbing' },
                                { key: 'lymph', label: 'No Lymphadenopathy' },
                                { key: 'edema', label: 'No Pedal Edema' },
                                { key: 'dehydration', label: 'No Dehydration' }
                            ].map((item) => {
                                const isChecked = patient.physicalExam?.general?.includes(item.label) || false;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => {
                                            const currentText = patient.physicalExam?.general || 'Conscious, stable.';
                                            let updatedText = '';
                                            if (currentText.includes(item.label)) {
                                                updatedText = currentText.replace(item.label, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                                            } else {
                                                updatedText = currentText ? currentText + ', ' + item.label : item.label;
                                            }
                                            updatePhysicalExam(patient.id, { general: updatedText });
                                        }}
                                        className={`p-2 rounded-lg border text-[11px] font-bold text-left transition-all active:scale-95 flex items-center gap-2 select-none cursor-pointer ${
                                            patient.physicalExam?.general?.includes(item.label)
                                                ? 'bg-blue-50/75 dark:bg-blue-950/20 border-[#0077b6] text-[#0077b6] font-extrabold shadow-sm'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                            patient.physicalExam?.general?.includes(item.label)
                                                ? 'bg-[#0077b6] border-[#0077b6] text-white'
                                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                                        }`}>
                                            {patient.physicalExam?.general?.includes(item.label) && <Check className="h-3 w-3 stroke-[3]" />}
                                        </div>
                                        <span className="truncate">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">General Condition Notes (Editable)</label>
                            <input
                                type="text"
                                value={patient.physicalExam?.general || ''}
                                onChange={(e) => updatePhysicalExam(patient.id, { general: e.target.value })}
                                className="w-full text-xs text-slate-800 dark:text-slate-200 p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-[#0077b6]"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="p-3 border-l-4 border-l-blue-400 bg-slate-50 dark:bg-slate-800/50 rounded-r-lg shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Inspection</span>
                                    <div className="flex gap-1">
                                        {['Wound Clean', 'Swelling +', 'Deformity +'].map(s => (
                                            <button 
                                                key={s}
                                                onClick={() => updateLocalExam(patient.id, { inspection: (patient.physicalExam?.localExam?.inspection || '') + (patient.physicalExam?.localExam?.inspection ? ', ' : '') + s })}
                                                className="text-[8px] px-1 border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-slate-800 text-blue-600"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <textarea 
                                    value={patient.physicalExam?.localExam?.inspection || ''}
                                    onChange={(e) => updateLocalExam(patient.id, { inspection: e.target.value })}
                                    className="w-full text-sm bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 focus:ring-0 min-h-[60px] resize-y"
                                    placeholder="Deformity, swelling, wounds..."
                                />
                            </div>
                            <div className="p-3 border-l-4 border-l-blue-500 bg-slate-50 dark:bg-slate-800/50 rounded-r-lg shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Palpation</span>
                                    <div className="flex flex-wrap gap-1">
                                        {['Tenderness +', 'No Crepitus', 'Temp ↑', 'Bony Irreg.', 'Fluctuance'].map(s => (
                                            <button 
                                                key={s}
                                                onClick={() => updateLocalExam(patient.id, { palpation: (patient.physicalExam?.localExam?.palpation || '') + (patient.physicalExam?.localExam?.palpation ? ', ' : '') + s })}
                                                className="text-[8px] px-1 border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-slate-800 text-blue-600 hover:bg-blue-50 transition-colors"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <textarea 
                                    value={patient.physicalExam?.localExam?.palpation || ''}
                                    onChange={(e) => updateLocalExam(patient.id, { palpation: e.target.value })}
                                    className="w-full text-sm bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 focus:ring-0 min-h-[60px] resize-y"
                                    placeholder="Tenderness, crepitus, temperature..."
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="p-3 border-l-4 border-l-blue-600 bg-slate-50 dark:bg-slate-800/50 rounded-r-lg shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest">Movements</span>
                                    <div className="flex gap-1">
                                        {['Full ROM', 'Painful', 'Fixed Flexion'].map(s => (
                                            <button 
                                                key={s}
                                                onClick={() => updateLocalExam(patient.id, { movements: (patient.physicalExam?.localExam?.movements || '') + (patient.physicalExam?.localExam?.movements ? ', ' : '') + s })}
                                                className="text-[8px] px-1 border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-slate-800 text-blue-600"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <textarea 
                                    value={patient.physicalExam?.localExam?.movements || ''}
                                    onChange={(e) => updateLocalExam(patient.id, { movements: e.target.value })}
                                    className="w-full text-sm bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 focus:ring-0 min-h-[60px] resize-y"
                                    placeholder="ROM, instability..."
                                />
                            </div>
                            <div className="p-3 border-l-4 border-l-[#0077b6] bg-slate-50 dark:bg-slate-800/50 rounded-r-lg shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black text-[#0077b6] dark:text-sky-400 uppercase tracking-widest">Neurovascular</span>
                                    <div className="flex flex-wrap gap-1">
                                        {['Distal NV Intact', 'Pulses 2+', 'CRT < 2s', 'DPA/PTA++', 'Normal Sensory', 'Normal Motor'].map(s => (
                                            <button 
                                                key={s}
                                                onClick={() => updateLocalExam(patient.id, { neurovascular: (patient.physicalExam?.localExam?.neurovascular || '') + (patient.physicalExam?.localExam?.neurovascular ? ', ' : '') + s })}
                                                className="text-[8px] px-1 border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-slate-800 text-blue-600 hover:bg-blue-50/50 transition-colors"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <textarea 
                                    value={patient.physicalExam?.localExam?.neurovascular || ''}
                                    onChange={(e) => updateLocalExam(patient.id, { neurovascular: e.target.value })}
                                    className="w-full text-sm bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 focus:ring-0 font-bold min-h-[60px] resize-y"
                                    placeholder="Pulses, sensation, motor..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Specialized Orthopedic Tests</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.entries(SPECIAL_TESTS).map(([category, tests]) => (
                                <div key={category} className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <span className="text-[9px] font-bold text-[#0077b6] dark:text-blue-400 uppercase tracking-tight block mb-2">{category}</span>
                                    <div className="flex flex-wrap gap-1">
                                        {tests.map(test => (
                                            <button
                                                key={test}
                                                onClick={() => updateLocalExam(patient.id, { specialTests: (patient.physicalExam?.localExam?.specialTests || '') + (patient.physicalExam?.localExam?.specialTests ? '\n' : '') + test })}
                                                className="text-[8px] px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded hover:border-[#0077b6] hover:text-[#0077b6] transition-all"
                                            >
                                                {test}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4">
                            <textarea 
                                value={patient.physicalExam?.localExam?.specialTests || ''}
                                onChange={(e) => updateLocalExam(patient.id, { specialTests: e.target.value })}
                                className="w-full text-sm p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 outline-none focus:border-[#0077b6] transition-all min-h-[80px]"
                                placeholder="Summary of special tests (Lachman, SLRT, Motor/Sensory clusters)..."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderInvestigations = (patient: OrthoPatient) => {
        const parsedResults = parseBloodReports(patient.investigations.blood || '');
        const outOfRangeCount = parsedResults.filter(r => r.status !== 'normal').length;

        return (
            <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-[#0077b6]" />
                        Investigations Summary
                    </h3>
                    <div className="space-y-4">
                        {/* Interactive Structured Investigation Log & Live Status Tracker */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 mb-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-rose-105/10 dark:border-slate-800 pb-3 gap-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-[#0077b6] animate-pulse shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Interactive Investigation Cockpit</h4>
                                        <p className="text-[10px] text-slate-400 font-medium leading-tight">Order, track status, and capture live path / radiology outcomes</p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 text-[9px] font-black uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/30 w-max shrink-0">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Live Tracker Active
                                </span>
                            </div>

                            {/* Creation Form */}
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-4">
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                    {/* Category Dropdown */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">1. Category</label>
                                        <CustomSearchableDropdown
                                            value={invType}
                                            onChange={(val) => {
                                                const selectedVal = val as 'Blood' | 'Urine' | 'Radiology' | 'Fluids' | 'Histopath' | 'Other';
                                                setInvType(selectedVal);
                                                const presets = TEST_PRESETS_BY_GROUP[selectedVal];
                                                if (presets && presets.length > 0) {
                                                    setInvName(presets[0]);
                                                }
                                            }}
                                            options={[
                                                { value: "Blood", label: "🩸 Blood Labs" },
                                                { value: "Urine", label: "🧪 Urine Analysis" },
                                                { value: "Radiology", label: "☢️ Radiology & Imaging" },
                                                { value: "Fluids", label: "💧 Body Fluids" },
                                                { value: "Histopath", label: "🔬 Histopathology / Biopsy" },
                                                { value: "Other", label: "📁 Other Investigations" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>

                                    {/* Predefined Dropdown OR Custom Option */}
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">2. Select Test OR Write Manually</label>
                                        <div className="flex gap-2 flex-col sm:flex-row min-w-0">
                                            <div className="flex-1 min-w-0">
                                                <CustomSearchableDropdown
                                                    value={TEST_PRESETS_BY_GROUP[invType]?.includes(invName) ? invName : '__custom__'}
                                                    onChange={(val) => {
                                                        if (val === '__custom__') {
                                                            setInvName('');
                                                        } else {
                                                            setInvName(val);
                                                        }
                                                    }}
                                                    options={[
                                                        ...(TEST_PRESETS_BY_GROUP[invType] || []).map(test => ({ value: test, label: test })),
                                                        { value: "__custom__", label: "✍️ Custom Manual Entry..." }
                                                    ]}
                                                />
                                            </div>

                                            {(!TEST_PRESETS_BY_GROUP[invType]?.includes(invName) || invName === '') && (
                                                <input
                                                    type="text"
                                                    value={invName}
                                                    onChange={(e) => setInvName(e.target.value)}
                                                    placeholder="Type test name manually..."
                                                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-xs text-slate-700 dark:text-slate-200 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-[#0077b6]"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Status Switcher selection */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">3. Status</label>
                                        <CustomSearchableDropdown
                                            value={invStatus}
                                            onChange={(val) => setInvStatus(val as any)}
                                            options={[
                                                { value: "Not ordered", label: "❌ Not Ordered" },
                                                { value: "Ordered", label: "📤 Ordered" },
                                                { value: "Sent", label: "🧪 Sent / Sample Sent" },
                                                { value: "Report pending", label: "⏳ Report Pending" },
                                                { value: "Received", label: "✅ Received (Report Came)" },
                                                { value: "Reviewed", label: "👁️ Reviewed by Resident" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>
                                </div>

                                {/* Results Notes and Trigger Button */}
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                                    <div className="lg:col-span-3 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">4. Results / Findings / Notes</label>
                                            {(invStatus === 'Received' || invStatus === 'Reviewed' || invStatus === 'Came') && (
                                                <span className="text-[8px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase animate-pulse">
                                                    * Results expected
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={invResult}
                                            onChange={(e) => setInvResult(e.target.value)}
                                            placeholder={(invStatus === 'Received' || invStatus === 'Reviewed' || invStatus === 'Came') ? "e.g., Hb: 10.3 g/dL, or No fracture line seen" : "e.g., Ordered by Dr. Amit / Sent to central lab (Optional info)"}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0077b6] placeholder:text-slate-400"
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!invName.trim()) return;
                                                const list = patient.investigations.structuredList || [];
                                                const isManualEntry = !TEST_PRESETS_BY_GROUP[invType]?.includes(invName.trim());
                                                const isPositiveArrived = invStatus === 'Received' || invStatus === 'Reviewed' || invStatus === 'Came';
                                                const newItem: StructuredInvestigation = {
                                                    id: editingInvId || `inv_${Date.now()}`,
                                                    type: invType,
                                                    name: invName.trim(),
                                                    status: invStatus,
                                                    result: isPositiveArrived ? (invResult.trim() || 'Report Came') : (invResult.trim() || 'Awaiting Report'),
                                                    updatedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                                                    orderedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                                    isManual: isManualEntry
                                                };

                                                let updatedList;
                                                if (editingInvId) {
                                                    updatedList = list.map(item => item.id === editingInvId ? newItem : item);
                                                    setEditingInvId(null);
                                                } else {
                                                    updatedList = [newItem, ...list];
                                                }

                                                updateInvestigations(patient.id, { structuredList: updatedList });
                                                setInvName('');
                                                setInvResult('');
                                                setInvStatus('Report pending');
                                            }}
                                            disabled={!invName.trim()}
                                            className="flex-1 bg-[#0077b6] hover:bg-[#005f92] text-white p-2.5 rounded-xl text-xs font-black uppercase text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40 shadow-sm"
                                        >
                                            {editingInvId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                            {editingInvId ? 'Update Log' : 'Save To Registry'}
                                        </button>
                                        {editingInvId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingInvId(null);
                                                    setInvType('Blood');
                                                    setInvName('');
                                                    setInvResult('');
                                                    setInvStatus('Report Pending');
                                                }}
                                                className="px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Live Registry Table List */}
                            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/45 dark:bg-slate-950/10 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Investigations Tracker Status Board</span>
                                    <span className="text-[9px] font-mono font-extrabold text-[#0077b6] bg-blue-50 dark:bg-blue-900/10 px-2 py-0.5 rounded">
                                        {(patient.investigations.structuredList || []).length} registered items
                                    </span>
                                </div>

                                {(patient.investigations.structuredList || []).length === 0 ? (
                                    <div className="p-8 text-center flex flex-col items-center justify-center select-none">
                                        <ClipboardList className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-2 stroke-1" />
                                        <h5 className="text-xs font-bold text-slate-600 dark:text-slate-400">No Interactive Investigations Logged</h5>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[340px] mt-1 leading-normal">
                                            Select Category, pick a pre-set test name or type standard radiology/labs, set status to Ord/Sent/Pending, and log to begin live ward-round monitoring.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                    <th className="px-4 py-3">Investigation / Path</th>
                                                    <th className="px-3 py-3">Ordered</th>
                                                    <th className="px-3 py-3">Live Status (Click to Quick-Advance)</th>
                                                    <th className="px-4 py-3">Findings & Results</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                {(patient.investigations.structuredList || []).map((item) => {
                                                    const statusObj = {
                                                        'Send': { bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400', next: 'Sample Sent' },
                                                        'Sample Sent': { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-100 dark:border-blue-950', text: 'text-[#0077b6] dark:text-blue-400', next: 'Report Pending' },
                                                        'Report Pending': { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-100 dark:border-amber-900/30', text: 'text-amber-650 dark:text-amber-450', next: 'Came' },
                                                        'Came': { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-450', next: 'Send' }
                                                    }[item.status] || { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', next: 'Send' };

                                                    return (
                                                        <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors">
                                                            {/* Name & Badge */}
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-base leading-none select-none shrink-0 border border-slate-100 dark:border-slate-800 p-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg shadow-sm">
                                                                        {item.type === 'Blood' ? '🩸' : item.type === 'Urine' ? '🧪' : item.type === 'Radiology' ? '☢️' : '📁'}
                                                                    </span>
                                                                    <div>
                                                                        <div className="font-extrabold text-slate-800 dark:text-slate-200 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                                                                            <span>{item.name}</span>
                                                                            {item.isManual && (
                                                                                <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                                                                    ✍️ Manual
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="inline-block text-[8px] font-black text-slate-400/85 uppercase tracking-widest font-mono">
                                                                            {item.type}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {/* Ordered Time */}
                                                            <td className="px-3 py-3 text-slate-400 dark:text-slate-400 text-[10px] whitespace-nowrap font-medium font-mono">
                                                                {item.orderedAt}
                                                                <span className="block text-[8px] text-slate-400/80 mt-0.5">{item.updatedAt}</span>
                                                            </td>
                                                            {/* Dynamic Status Badges with Quick togglers */}
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                <button
                                                                    type="button"
                                                                    title={`Click to advance to: ${statusObj.next}`}
                                                                    onClick={() => {
                                                                        const nextStatus = statusObj.next as any;
                                                                        const updatedList = (patient.investigations.structuredList || []).map(listItem => {
                                                                            if (listItem.id === item.id) {
                                                                                let res = listItem.result;
                                                                                if (nextStatus !== 'Came') {
                                                                                    res = 'Awaiting Report';
                                                                                } else if (res === 'Awaiting Report' || !res) {
                                                                                    res = 'Report Arrived';
                                                                                }
                                                                                return {
                                                                                    ...listItem,
                                                                                    status: nextStatus,
                                                                                    result: res,
                                                                                    updatedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                                                                };
                                                                            }
                                                                            return listItem;
                                                                        });
                                                                        updateInvestigations(patient.id, { structuredList: updatedList });
                                                                    }}
                                                                    className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border select-none transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer 
                                                                        ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}
                                                                >
                                                                    <span className={`h-1.5 w-1.5 rounded-full ${item.status === 'Report Pending' ? 'bg-amber-500 animate-pulse' : item.status === 'Came' ? 'bg-emerald-500' : item.status === 'Sample Sent' ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}`} />
                                                                    {item.status}
                                                                </button>
                                                            </td>
                                                            {/* Findings & Results */}
                                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold max-w-[200px] break-words">
                                                                {item.status === 'Came' ? (
                                                                    <div className="font-extrabold flex items-center gap-1.5 flex-wrap text-emerald-600 dark:text-emerald-450 bg-emerald-50/40 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100/50">
                                                                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                                                                        <span>{item.result}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[10px] text-slate-400 italic">
                                                                        {item.result || 'Pending evaluation...'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            {/* Actions */}
                                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                                <div className="inline-flex gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingInvId(item.id);
                                                                            setInvType(item.type);
                                                                            setInvName(item.name);
                                                                            setInvStatus(item.status);
                                                                            setInvResult(item.result === 'Awaiting Report' ? '' : item.result);
                                                                        }}
                                                                        className="p-1 px-2 text-slate-400 hover:text-[#0077b6] hover:bg-slate-100 dark:hover:bg-slate-805 rounded cursor-pointer transition-all border border-slate-100 dark:border-slate-800"
                                                                        title="Edit item findings"
                                                                    >
                                                                        <FileText className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const updatedList = (patient.investigations.structuredList || []).filter(listItem => listItem.id !== item.id);
                                                                            updateInvestigations(patient.id, { structuredList: updatedList });
                                                                        }}
                                                                        className="p-1 px-2 text-slate-400 hover:text-red-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded cursor-pointer transition-all border border-slate-100 dark:border-slate-800"
                                                                        title="Remove from Cockpit"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={`flex flex-col gap-3 p-4 rounded-xl border shadow-sm transition-all focus-within:ring-2 
                            ${outOfRangeCount > 0 
                                ? 'bg-red-50/20 dark:bg-red-950/10 border-red-200 dark:border-red-950 focus-within:ring-red-100 dark:focus-within:ring-red-900/20' 
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/80 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/20'}`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 
                                    ${outOfRangeCount > 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-blue-100 dark:bg-blue-900/30'}`}
                                >
                                    <Activity className={`h-5 w-5 ${outOfRangeCount > 0 ? 'text-red-600' : 'text-[#0077b6]'}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${outOfRangeCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500/80 dark:text-slate-400'}`}>
                                            Blood Reports (Hb, WBC, Platelets, Lytes)
                                        </span>
                                        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar max-w-[200px]">
                                            {COMMON_LABS.map(lab => (
                                                <button 
                                                    key={lab.label}
                                                    onClick={() => updateInvestigations(patient.id, { blood: (patient.investigations.blood || '') + (patient.investigations.blood ? ', ' : '') + `${lab.label}: ` })}
                                                    className={`text-[8px] px-1 border rounded bg-white dark:bg-slate-800 whitespace-nowrap 
                                                        ${outOfRangeCount > 0 ? 'border-red-200 dark:border-red-800 text-red-600' : 'border-blue-200 dark:border-blue-800 text-[#0077b6]'}`}
                                                >
                                                    + {lab.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <textarea 
                                        value={patient.investigations.blood || ''}
                                        onChange={(e) => updateInvestigations(patient.id, { blood: e.target.value })}
                                        className="w-full text-sm bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 focus:ring-0 font-medium min-h-[40px] resize-y"
                                        placeholder="e.g. Hb 10.5, WBC 12k..."
                                    />
                                </div>
                            </div>

                            {/* Dynamically parsed blood results indicating out of clinical range values */}
                            {parsedResults.length > 0 && (
                                <div className="mt-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/80">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Sparkles className="h-3 w-3 text-[#0077b6]" /> Automatic Lab safety scan
                                        </span>
                                        {outOfRangeCount > 0 ? (
                                            <span className="text-[9px] font-black uppercase bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                                <AlertTriangle className="h-3 w-3" /> {outOfRangeCount} Abnormal Labs Detected
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-black uppercase bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3" /> All Parsed Labs Normal
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                                        {parsedResults.map((res) => {
                                            const isAbnormal = res.status !== 'normal';
                                            return (
                                                <div 
                                                    key={res.name}
                                                    className={`p-2.5 rounded-lg border transition-all flex flex-col justify-between ${
                                                        isAbnormal 
                                                            ? 'bg-red-50/80 dark:bg-red-950/20 border-red-250 dark:border-red-900/40 shadow-[2px_2px_0_0_#ef4444]' 
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`text-[10px] font-extrabold tracking-tight ${isAbnormal ? 'text-red-800 dark:text-red-300' : 'text-slate-500'}`}>
                                                            {res.displayName}
                                                        </span>
                                                        <span className={`text-[8px] font-black uppercase px-1 rounded-sm ${
                                                            res.status === 'low' 
                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' 
                                                                : res.status === 'high' 
                                                                ? 'bg-red-500 text-white' 
                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                        }`}>
                                                            {res.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-baseline gap-1 my-1">
                                                        <span className={`text-sm font-black tracking-tight ${isAbnormal ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                            {res.value}
                                                        </span>
                                                        <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">{res.unit}</span>
                                                    </div>
                                                    <div className="text-[9px] mt-1 font-mono text-slate-400 dark:text-slate-500 flex justify-between">
                                                        <span>Ref: {res.min} - {res.max}</span>
                                                        {isAbnormal && (
                                                            <span className="text-red-500 dark:text-red-450 font-bold uppercase text-[8px] italic flex items-center gap-0.5">
                                                                Out of Range
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Clinical Orthopaedic Warning Alert if critical Hb or Potassium occurs */}
                                    {parsedResults.some(r => r.name === 'Hb' && r.status === 'low' && r.value < 8.0) && (
                                        <div className="mt-3 p-3 bg-red-100 dark:bg-red-950/40 text-red-900 dark:text-red-200 border border-red-300/40 rounded-lg flex items-start gap-2 text-xs">
                                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="font-bold">CRITICAL DEEP ANEMIA WARNING:</strong> Hb is below 8.0 g/dL ({parsedResults.find(r => r.name === 'Hb')?.value} g/dL). 
                                                High perioperative risk. Resident attention required to evaluate the need for cross-matching packed red blood cells (PRBCs) and potential blood transfusion.
                                            </div>
                                        </div>
                                    )}

                                    {parsedResults.some(r => r.name === 'Potassium' && r.status !== 'normal') && (
                                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-955/20 text-amber-900 dark:text-amber-200 border border-amber-300/40 rounded-lg flex items-start gap-2 text-xs">
                                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="font-bold">ANESTHESIA ALERT:</strong> Serum Potassium is out of range ({parsedResults.find(r => r.name === 'Potassium')?.value} mEq/L). 
                                                Ensure cardiac clearance is obtained and electrolyte repletion/stabilization protocol initiated prior to spinal or general anesthesia.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <HemoglobinTrendTracker 
                            patient={patient} 
                            onUpdateHistory={(newHistory) => updateInvestigations(patient.id, { hbHistory: newHistory })} 
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all focus-within:ring-2 focus-within:ring-amber-100 dark:focus-within:ring-amber-900/20">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                <FileText className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <span className="text-[10px] font-black text-amber-600/60 dark:text-amber-400 uppercase block mb-1 tracking-widest">Urine Analysis</span>
                                <textarea 
                                    value={patient.investigations.urine || ''}
                                    onChange={(e) => updateInvestigations(patient.id, { urine: e.target.value })}
                                    className="w-full text-sm bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 focus:ring-0 min-h-[40px] resize-y"
                                    placeholder="Clear, nil albumin..."
                                />
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/20">
                            <div className="w-10 h-10 rounded-lg bg-blue-50/80 dark:bg-blue-950/20 flex items-center justify-center flex-shrink-0">
                                <Eye className="h-5 w-5 text-[#0077b6]" />
                            </div>
                            <div className="flex-1">
                                <span className="text-[10px] font-black text-[#0077b6]/80 dark:text-sky-400 uppercase block mb-1 tracking-widest">Imaging (X-ray, CT, MRI)</span>
                                <textarea 
                                    value={patient.investigations.imaging || ''}
                                    onChange={(e) => updateInvestigations(patient.id, { imaging: e.target.value })}
                                    className="w-full text-sm bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 focus:ring-0 font-bold min-h-[40px] resize-y"
                                    placeholder="Fracture site, alignment..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Imaging Viewer</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {patient.attachments.filter(a => a.type === 'xray').map(att => (
                        <div key={att.id} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-black">
                            <img src={att.url} alt={att.name} className="w-full h-40 object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                <p className="text-[10px] text-white font-medium truncate">{att.name}</p>
                            </div>
                        </div>
                    ))}
                    {patient.attachments.filter(a => a.type === 'xray').length === 0 && (
                        <div className="col-span-full py-8 text-center text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                            <p className="text-xs">No X-rays uploaded yet. Upload in the Plan section.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Compare X-rays Tool Component */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mt-6 print:hidden">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-[#0077b6] animate-pulse" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Compare X-rays Tool</h3>
                    </div>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                        Resident Assistant
                    </span>
                </div>

                {patient.attachments.filter(a => a.type === 'xray').length < 2 ? (
                    <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/40">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Minimum 2 X-rays required for Comparative Tool</p>
                        <p className="text-xs text-slate-400 mt-1">Please upload more X-ray attachments in the Plan/Investigations section to compare.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Selector Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                                    X-ray Image A (Baseline / Pre-op)
                                </label>
                                <CustomSearchableDropdown
                                    value={compareXray1Id}
                                    onChange={(val) => {
                                        setCompareXray1Id(val);
                                        setComparisonSummary(''); // Clear old summary on selection change
                                    }}
                                    placeholder="Select Image A..."
                                    options={patient.attachments.filter(a => a.type === 'xray').map(att => ({
                                        value: att.id,
                                        label: att.name,
                                        disabled: att.id === compareXray2Id
                                    }))}
                                    searchable={false}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                                    X-ray Image B (Follow-up / Post-op)
                                </label>
                                <CustomSearchableDropdown
                                    value={compareXray2Id}
                                    onChange={(val) => {
                                        setCompareXray2Id(val);
                                        setComparisonSummary(''); // Clear old summary on selection change
                                    }}
                                    placeholder="Select Image B..."
                                    options={patient.attachments.filter(a => a.type === 'xray').map(att => ({
                                        value: att.id,
                                        label: att.name,
                                        disabled: att.id === compareXray1Id
                                    }))}
                                    searchable={false}
                                />
                            </div>
                        </div>

                        {/* Side by Side Preview */}
                        {(compareXray1Id || compareXray2Id) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950 p-4 rounded-xl">
                                {/* Image A Box */}
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black tracking-widest text-[#0077b6] uppercase mb-2">
                                        [IMAGE A] {compareXray1Id ? patient.attachments.find(a => a.id === compareXray1Id)?.name : 'Empty Selection'}
                                    </span>
                                    <div className="w-full h-64 border border-slate-800 bg-black rounded-lg overflow-hidden flex items-center justify-center relative group">
                                        {compareXray1Id ? (
                                            <>
                                                <img 
                                                    src={patient.attachments.find(a => a.id === compareXray1Id)?.url} 
                                                    alt="X-ray A" 
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                                <div className="absolute top-2 left-2 bg-slate-900/85 text-white font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                                                    Pre-op / Baseline
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-slate-600 text-xs font-mono">Select image above</span>
                                        )}
                                    </div>
                                </div>

                                {/* Image B Box */}
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase mb-2">
                                        [IMAGE B] {compareXray2Id ? patient.attachments.find(a => a.id === compareXray2Id)?.name : 'Empty Selection'}
                                    </span>
                                    <div className="w-full h-64 border border-slate-800 bg-black rounded-lg overflow-hidden flex items-center justify-center relative group">
                                        {compareXray2Id ? (
                                            <>
                                                <img 
                                                    src={patient.attachments.find(a => a.id === compareXray2Id)?.url} 
                                                    alt="X-ray B" 
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                                <div className="absolute top-2 left-2 bg-emerald-950/85 text-emerald-400 font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                                                    Follow-up / Post-op
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-slate-600 text-xs font-mono">Select image above</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Trigger Button */}
                        <div className="flex justify-center">
                            <button
                                onClick={handleCompareXrays}
                                disabled={isComparingXrays || !compareXray1Id || !compareXray2Id}
                                className={`flex items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#0077b6]/50
                                    ${(!compareXray1Id || !compareXray2Id)
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                                        : 'bg-[#0077b6] text-white hover:bg-[#005f92] hover:shadow-lg hover:shadow-[#0077b6]/20'
                                    }`}
                            >
                                {isComparingXrays ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Comparing with AI Gemini...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4" />
                                        Run AI Comparative Analysis
                                    </>
                                )}
                            </button>
                        </div>

                        {/* AI Comparison Results Section */}
                        {isComparingXrays && (
                            <div className="p-6 bg-[#0077b6]/5 dark:bg-[#0077b6]/10 border border-[#0077b6]/20 rounded-xl space-y-3 animate-pulse">
                                <div className="flex items-center gap-2 text-[#0077b6] text-xs font-bold uppercase tracking-wider">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Synthesizing radiologic differences...
                                </div>
                                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                            </div>
                        )}

                        {comparisonSummary && (
                            <div className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-[#0077b6]" />
                                        <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-widest">
                                            AI Radiographic Comparison Report
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleShareComparison}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/40 text-[#0077b6] hover:bg-[#0077b6] hover:text-white rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider border border-blue-150 dark:border-blue-900/30 cursor-pointer"
                                            title="Share or Copy Comparison Report"
                                        >
                                            <Share2 className="h-3.5 w-3.5" />
                                            {shareSuccess ? 'Copied!' : 'Share Report'}
                                        </button>
                                        <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
                                            Verified Ortho assistant
                                        </div>
                                    </div>
                                </div>

                                <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-[1.7] text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">
                                    <Markdown>{comparisonSummary}</Markdown>
                                </div>

                                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-300 border border-red-200 dark:border-red-900/30 rounded-lg flex items-start gap-2 text-xs">
                                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                    <span className="font-bold">
                                        Disclaimer: AI-generated comparative summary. Must be verified by the Resident/Attending.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

    const handleAddDailyNote = (patientId: string) => {
        const newNote = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            vitals: { bp: '', pulse: 0, temp: 0, rr: 0, spo2: 0, timestamp: new Date().toISOString() },
            subjective: '',
            objective: '',
            assessment: '',
            plan: '',
            addedBy: 'Resident'
        };
        
        setPatients(prev => prev.map(p => {
            if (p.id === patientId) {
                return { ...p, dailyNotes: [newNote, ...(p.dailyNotes || [])] };
            }
            return p;
        }));
    };

    const updateDailyNote = (patientId: string, noteId: string, updates: Partial<OrthoPatient['dailyNotes' & number]>) => {
        setPatients(prev => prev.map(p => {
            if (p.id === patientId) {
                return {
                    ...p,
                    dailyNotes: p.dailyNotes?.map(note => note.id === noteId ? { ...note, ...updates } : note)
                };
            }
            return p;
        }));
    };

    const renderDailyProgress = (patient: OrthoPatient) => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="h-5 w-5 text-[#0077b6]" />
                        Daily Progress Notes
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Track patient progress day-by-day (SOAP format)</p>
                </div>
                <button 
                    onClick={() => handleAddDailyNote(patient.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0077b6] text-white rounded-xl hover:bg-[#005f92] transition-colors font-bold text-sm shadow-sm"
                >
                    <Plus className="h-4 w-4" /> Add Note for Today
                </button>
            </div>

            <div className="space-y-6">
                {patient.dailyNotes && patient.dailyNotes.length > 0 ? (
                    patient.dailyNotes.map((note) => (
                        <div key={note.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="text-sm font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                                        <History className="h-3.5 w-3.5 text-[#0077b6]" />
                                        {new Date(note.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{note.addedBy}</span>
                                </div>
                                <button 
                                    onClick={() => {
                                        if (confirm("Delete this note?")) {
                                            setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, dailyNotes: p.dailyNotes?.filter(n => n.id !== note.id) } : p));
                                        }
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="p-6">
                                {/* SOAP Editor */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-[#0077b6] uppercase mb-1.5 block tracking-widest">Subjective (Symptoms)</label>
                                            <textarea 
                                                value={note.subjective}
                                                onChange={(e) => updateDailyNote(patient.id, note.id, { subjective: e.target.value })}
                                                placeholder="e.g. Pain decreasing, appetite good..."
                                                className="w-full text-sm p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[80px]"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-purple-600 uppercase mb-1.5 block tracking-widest">Objective (Vitals/Exam)</label>
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase block">BP</span>
                                                    <input 
                                                        type="text" 
                                                        value={note.vitals?.bp || ''} 
                                                        onChange={(e) => updateDailyNote(patient.id, note.id, { vitals: { ...note.vitals as any, bp: e.target.value } })}
                                                        className="w-full text-xs font-bold bg-transparent outline-none"
                                                    />
                                                </div>
                                                <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase block">Pulse</span>
                                                    <input 
                                                        type="number" 
                                                        value={note.vitals?.pulse || ''} 
                                                        onChange={(e) => updateDailyNote(patient.id, note.id, { vitals: { ...note.vitals as any, pulse: parseInt(e.target.value) || 0 } })}
                                                        className="w-full text-xs font-bold bg-transparent outline-none"
                                                    />
                                                </div>
                                                <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase block">SpO2</span>
                                                    <input 
                                                        type="number" 
                                                        value={note.vitals?.spo2 || ''} 
                                                        onChange={(e) => updateDailyNote(patient.id, note.id, { vitals: { ...note.vitals as any, spo2: parseInt(e.target.value) || 0 } })}
                                                        className="w-full text-xs font-bold bg-transparent outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <textarea 
                                                value={note.objective}
                                                onChange={(e) => updateDailyNote(patient.id, note.id, { objective: e.target.value })}
                                                placeholder="e.g. Wound healthy, drainage 20ml..."
                                                className="w-full text-sm p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-purple-400 min-h-[80px]"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-amber-600 uppercase mb-1.5 block tracking-widest">Assessment</label>
                                            <textarea 
                                                value={note.assessment}
                                                onChange={(e) => updateDailyNote(patient.id, note.id, { assessment: e.target.value })}
                                                placeholder="e.g. Improving, clinically stable..."
                                                className="w-full text-sm p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-400 min-h-[80px]"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-green-600 uppercase mb-1.5 block tracking-widest">Plan</label>
                                            <textarea 
                                                value={note.plan}
                                                onChange={(e) => updateDailyNote(patient.id, note.id, { plan: e.target.value })}
                                                placeholder="e.g. Continue meds, start mobilization..."
                                                className="w-full text-sm p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-green-400 min-h-[148px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-wrap gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex-1 min-w-[200px]">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Drainage Output (ml)</span>
                                        <input 
                                            type="text"
                                            value={note.drainage || ''}
                                            onChange={(e) => updateDailyNote(patient.id, note.id, { drainage: e.target.value })}
                                            placeholder="e.g. 50ml serosanguinous"
                                            className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-100 dark:border-slate-800 outline-none"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-[200px]">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Mobilization Status</span>
                                        <input 
                                            type="text"
                                            value={note.mobilization || ''}
                                            onChange={(e) => updateDailyNote(patient.id, note.id, { mobilization: e.target.value })}
                                            placeholder="e.g. Toe touch weight bearing"
                                            className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-100 dark:border-slate-800 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                        <Clock className="h-12 w-12 text-slate-200 dark:text-slate-800 dark:text-slate-200 mx-auto mb-4" />
                        <h4 className="text-slate-900 dark:text-white font-bold">No progress notes yet</h4>
                        <p className="text-sm text-slate-400 mt-1">Start recording daily patient progress to track recovery.</p>
                        <button 
                            onClick={() => handleAddDailyNote(patient.id)}
                            className="mt-6 px-6 py-2 bg-[#0077b6] text-white rounded-xl hover:bg-[#005f92] transition-colors font-bold text-sm shadow-sm"
                        >
                            Create First Daily Note
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderPlan = (patient: OrthoPatient) => (
        <div className="space-y-6">
            <ProcedureTimer patient={patient} updatePatient={updatePatient} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">
                    <CheckCircle className="h-4 w-4" /> Active Plan / Pending
                </h3>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-2 shadow-sm border border-slate-200 dark:border-slate-800">
                    {patient.plan && patient.plan.length > 0 ? (
                        <ul className="space-y-1">
                            {patient.plan.map(item => (
                                <li 
                                    key={item.id} 
                                    onClick={() => togglePlanItem(patient.id, item.id)}
                                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50
                                        ${item.status === 'done' ? 'opacity-60 bg-slate-50 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900'}`}
                                >
                                    <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                                        ${item.status === 'done' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {item.status === 'done' && <CheckCircle className="h-4 w-4" />}
                                    </div>
                                    <span className={`text-sm flex-1 ${item.status === 'done' ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-200 font-medium'}`}>
                                        {item.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-sm text-slate-500 italic text-center">
                            No active plan identified.
                        </div>
                    )}
                </div>
            </div>
            <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">
                    <Paperclip className="h-4 w-4" /> Attachments & Documents
                </h3>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="mb-4">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500">
                                <Upload className="w-8 h-8 mb-3 opacity-50" />
                                <p className="mb-2 text-sm font-semibold">Click to upload X-ray or Report</p>
                                <p className="text-xs text-slate-400">PNG, JPG or PDF (Max 10MB)</p>
                            </div>
                            <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                        </label>
                    </div>

                    <div className="space-y-3">
                        {patient.attachments && patient.attachments.length > 0 ? (
                            patient.attachments.map(att => (
                                <div key={att.id} className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden transition-all bg-slate-50/50 dark:bg-slate-900/50">
                                    <div className="p-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                                {att.type === 'xray' ? <Eye className="w-5 h-5 text-[#0077b6]" /> : <FileText className="w-5 h-5 text-blue-500" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{att.name}</p>
                                                <p className="text-[10px] text-slate-500">{att.timestamp}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {att.type === 'xray' && !att.aiInterpretation && (
                                                <button 
                                                    onClick={() => handleAnalyzeXray(att.id)}
                                                    disabled={isAnalyzingImage === att.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/45 dark:border-blue-900/35 text-[#0077b6] dark:text-sky-400 text-xs font-bold rounded-lg"
                                                >
                                                    {isAnalyzingImage === att.id ? <Loader2 className="w-3 h-3 animate-spin text-[#0077b6]" /> : <Sparkles className="w-3 h-3" />}
                                                    Interpret
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {att.aiInterpretation && (
                                        <div className="p-3 bg-blue-50/20 dark:bg-blue-950/10 border-t border-blue-105/30 dark:border-blue-900/20">
                                            <p className="text-xs text-slate-605 dark:text-slate-400 italic leading-relaxed">
                                                <Sparkles className="w-3 h-3 inline mr-1 text-[#0077b6]" />
                                                {att.aiInterpretation}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-xs text-slate-400 py-4">No attachments yet.</p>
                        )}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );


    const handleCopySummary = (p: OrthoPatient) => {
        const text = `=========================================
      G-MED 3.0 DISCHARGE SUMMARY
=========================================
PATIENT: ${p.demographics.rank ? p.demographics.rank + ' ' : ''}${p.demographics.name}
AGE/SEX: ${p.demographics.age} Yrs / ${p.demographics.sex}
HOSPITAL ID: ${p.demographics.hospitalId}
BED NUMBER: ${p.demographics.bedNumber}
SBH NUMBER: ${p.demographics.sbhNumber}
ADMISSION DATE: ${p.demographics.admissionDate ? new Date(p.demographics.admissionDate).toLocaleDateString('en-IN') : 'N/A'}
DISCHARGE DATE: ${new Date().toLocaleDateString('en-IN')}

DIAGNOSIS:
${p.diagnosis.toUpperCase()}
${p.classification ? `Classification: ${p.classification}` : ''}
${p.comorbidities && p.comorbidities.length > 0 ? `Comorbidities: ${p.comorbidities.join(', ')}` : ''}

SURGICAL PROCEDURE:
${p.surgicalProcedure || 'N/A'}

HOSPITAL COURSE:
${p.hospitalCourse || 'Daily notes summary not synthesized yet.'}

FINAL ASSESSMENT & CLINICAL PROGRESS:
${p.dischargeNote || p.soapNote || 'No final clinical progress summary recorded.'}

MEDICATIONS & SPECIAL ADVICE:
${p.specialAdvice || 'Routine bone health medications, analgesia as needed, and strict limb elevation.'}

FOLLOW-UP PLAN & TARGET DATE:
Follow-up date: ${p.followUpDate || 'OPD follow-up as advised.'}
Pending items:
${p.plan.filter(i => i.status === 'pending').map((i, idx) => `  - ${i.text}`).join('\n') || '  - Review in Orthopaedic OPD with X-ray in 1 week.'}

-----------------------------------------
AI-generated summary. Must be verified by the Resident/Attending.
=========================================`;

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error("Failed to copy summary to clipboard: ", err);
        });
    };

    const handleExportHTML = (p: OrthoPatient) => {
        const formattedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        const admDate = p.demographics.admissionDate 
            ? new Date(p.demographics.admissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'N/A';
        const followUp = p.followUpDate 
            ? new Date(p.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'As advised in OPD';

        const rawMarkdown = p.dischargeNote || p.soapNote || 'Patient was clinically stable at the time of discharge. Distal neurovascular status intact. Surgical site has high-quality healthy healing. Minimal serous discharge seen. Safe mobilization with a walker initiated.';
        let parsedOutput = '';
        try {
            parsedOutput = marked.parse(rawMarkdown, { async: false }) as string;
        } catch (e) {
            parsedOutput = `<p>${rawMarkdown}</p>`;
        }

        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discharge Summary - ${p.demographics.name}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        
        * { box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            margin: 0;
            padding: 2rem;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            line-height: 1.5;
        }
        .page-container {
            max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        }
        
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #0077b6; padding-bottom: 20px; margin-bottom: 30px; }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .logo-box { width: 48px; height: 48px; background-color: #0077b6; color: white; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: 900; font-size: 20px; font-style: italic; }
        .header-title h2 { color: #0077b6; font-size: 24px; font-weight: 900; margin: 0 0 4px 0; text-transform: uppercase; font-style: italic; }
        .header-title p { margin: 0; font-size: 10px; color: #64748b; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
        .header-right { text-align: right; }
        .header-right .sbh { font-size: 20px; font-weight: 900; margin-bottom: 4px; }
        .header-right .doc-id { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }

        .grid-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; margin-bottom: 30px; padding-bottom: 30px; border-bottom: 1px solid #f1f5f9; }
        .demographics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        
        .label { display: block; font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .value { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
        .value-large { font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
        .value-sub { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 4px; }
        .date-highlight { font-size: 14px; font-weight: 700; color: #1e293b; text-transform: uppercase; text-decoration: underline; text-decoration-color: #cbd5e1; font-style: italic; }

        .vitals-box { background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9; }
        .vital-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
        .vital-row:last-child { margin-bottom: 0; }
        .vital-label { color: #64748b; font-weight: 700; }
        .vital-val { font-weight: 900; color: #0f172a; }

        .section-title { font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0; display: flex; align-items: center; gap: 12px; }
        .section-title.center { justify-content: center; text-align: center; }
        .section-title.underline-title { text-decoration: underline; text-decoration-color: #cbd5e1; text-underline-offset: 4px; font-style: italic; border: none; }
        .section-title::before, .section-title::after { content: ""; flex: 1; height: 2px; background-color: #f1f5f9; }
        .section-title.no-lines::before, .section-title.no-lines::after { display: none; }
        
        .box { background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9; margin-bottom: 30px; font-size: 14px; color: #334155; font-weight: 500; }
        .box-green { background-color: #f0fdf4; border-color: #dcfce7; color: #166534; font-weight: 900; text-align: center; text-transform: uppercase; font-size: 16px; }
        .box-amber { background-color: #fffbeb; border-color: #fef3c7; color: #92400e; font-weight: 700; }
        .box-blue { background-color: #eff6ff; border-color: #dbeafe; color: #1e40af; }
        
        .two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        
        .classification-badge { display: inline-block; padding: 4px 8px; background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 4px; margin-right: 8px; }
        .comorbidity-badge { display: inline-block; padding: 4px 12px; background: white; border: 1px solid #e2e8f0; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 8px; margin-right: 8px; margin-bottom: 8px; }
        
        ul.plan-list { list-style: none; padding: 0; margin: 0; }
        ul.plan-list li { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; font-weight: 700; font-size: 14px; color: #1e293b; }
        ul.plan-list li .number { background: #2563eb; color: white; width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; flex-shrink: 0; }
        
        .target-date { border-top: 1px solid #bfdbfe; padding-top: 16px; margin-top: 16px; display: flex; justify-content: space-between; font-size: 12px; }
        .target-date .lbl { font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
        .target-date .val { font-weight: 900; color: #020617; }
        
        .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 80px; padding-top: 20px; }
        .sig-block { text-align: center; }
        .sig-line { height: 2px; background: #0f172a; margin-bottom: 12px; }
        .sig-label { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
        
        .footer { margin-top: 60px; background: #001d36; color: white; padding: 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
        .footer-content { position: relative; z-index: 2; max-width: 80%; }
        .footer-title { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6; margin: 0 0 8px 0; font-weight: 700; }
        .footer-text { margin: 0; font-size: 11px; font-weight: 700; font-style: italic; line-height: 1.6; opacity: 0.9; }
        .footer-logo { position: relative; z-index: 2; font-size: 24px; font-weight: 900; font-style: italic; opacity: 0.2; }
        
        .markdown-output { font-size: 14px; line-height: 1.8; color: #334155; }
        .markdown-output table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .markdown-output th, .markdown-output td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
        .markdown-output th { background-color: #f1f5f9; font-weight: 700; color: #0f172a; }
        .markdown-output h2, .markdown-output h3 { font-size: 16px; font-weight: 900; margin-top: 24px; margin-bottom: 12px; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        .markdown-output p { margin-bottom: 16px; }
        .markdown-output ul { padding-left: 24px; margin-bottom: 16px; }
        
        .top-action { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; max-width: 800px; margin-left: auto; margin-right: auto; }
        .top-action p { margin: 0; font-size: 12px; color: #1d4ed8; }
        .top-action strong { font-weight: 700; }
        .btn-print { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 12px; }
        .btn-print:hover { background: #1d4ed8; }
        
        @media print {
            body { background: white; padding: 0; }
            .page-container { box-shadow: none; max-width: 100%; border-radius: 0; padding: 0; }
            .top-action { display: none; }
        }
    </style>
</head>
<body>
    <div class="top-action">
        <div>
            <p>✨ <strong>Your Discharge Summary is ready!</strong></p>
            <p>This layout is designed to render perfectly in PDF generators and image previewers.</p>
        </div>
        <button class="btn-print" onclick="window.print()">Print Document</button>
    </div>

    <div class="page-container">
        <!-- Header -->
        <div class="header">
            <div class="header-left">
                <div class="logo-box">GM</div>
                <div class="header-title">
                    <h2>Discharge Summary</h2>
                    <p>G-MED 3.0 Clinical Management System / Dept. of Orthopaedics</p>
                </div>
            </div>
            <div class="header-right">
                <div class="sbh">${p.demographics.sbhNumber}</div>
                <div class="doc-id">Document ID: ${p.id.slice(0, 4).toUpperCase()}</div>
            </div>
        </div>

        <!-- Grid -->
        <div class="grid-layout">
            <div class="demographics-grid">
                <div>
                    <span class="label">Patient Identity</span>
                    <div class="value-large" style="display: flex; align-items: baseline; flex-wrap: wrap;">
                        ${p.demographics.rank ? `<span style="color:#64748b; font-size:14px; margin-right:6px;">${p.demographics.rank}</span>` : ''}
                        <span style="margin-right: 8px;">${p.demographics.name}</span>
                        <span style="font-size: 14px; color: #64748b; font-weight: 700;">${p.demographics.age}y ${p.demographics.sex}</span>
                    </div>
                    ${(p.demographics.unit || p.demographics.address) ? `
                        <div class="value-sub">${[p.demographics.unit, p.demographics.address].filter(Boolean).join(' · ')}</div>
                    ` : ''}
                </div>
                <div>
                    <span class="label">Vital Statistics</span>
                    <div class="value">${p.demographics.age} Yrs / ${p.demographics.sex}</div>
                </div>
                <div>
                    <span class="label">Admission & Injury</span>
                    <div class="value">Bed: ${p.demographics.bedNumber} · ID: ${p.demographics.hospitalId}</div>
                    <div class="value-sub" style="margin-top:8px;">Admitted: ${admDate}</div>
                </div>
                <div>
                    <span class="label">Discharge Date</span>
                    <div class="date-highlight">${formattedDate}</div>
                </div>
            </div>

            <div class="vitals-box">
                <span class="label" style="margin-bottom:12px;">Assessment Vitals</span>
                <div class="vital-row">
                    <span class="vital-label">BP</span>
                    <span class="vital-val">${p.physicalExam?.vitals?.bp || '---'}</span>
                </div>
                <div class="vital-row">
                    <span class="vital-label">PR</span>
                    <span class="vital-val">${p.physicalExam?.vitals?.pulse || '---'} bpm</span>
                </div>
                <div class="vital-row">
                    <span class="vital-label">SpO2</span>
                    <span class="vital-val">${p.physicalExam?.vitals?.spo2 || '---'}%</span>
                </div>
            </div>
        </div>

        <!-- Content blocks -->
        <div class="section-title">Diagnosis & Classification</div>
        <div class="box">
            <div style="font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; font-style: italic; margin-bottom: 12px;">
                ${p.diagnosis}
            </div>
            ${p.classification ? `
                <div style="margin-bottom: 16px;">
                    <span class="classification-badge">Classification</span>
                    <span style="font-weight: 700; color: #1d4ed8; font-size: 14px;">${p.classification} ${p.fractureType ? `[ Grade ${p.fractureType} ]` : ''}</span>
                </div>
            ` : ''}
            ${p.comorbidities && p.comorbidities.length > 0 ? `
                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; flex-wrap: wrap; align-items: center;">
                    <span class="label" style="margin: 0 12px 0 0; display: inline-block;">Comorbidities:</span>
                    ${p.comorbidities.map(c => `<span class="comorbidity-badge">${c}</span>`).join('')}
                </div>
            ` : ''}
        </div>

        <div class="section-title">Case Overview</div>
        <div class="box markdown-output" style="background-color: white; border-color: #cbd5e1; padding: 30px;">${parsedOutput}</div>

        <div class="sigs">
            <div class="sig-block">
                <div class="sig-line"></div>
                <div class="sig-label">Treatment Team Resident</div>
            </div>
            <div class="sig-block">
                <div class="sig-line"></div>
                <div class="sig-label">Consultant Orthopaedic Surgeon</div>
            </div>
        </div>

        <div class="footer">
            <div class="footer-content">
                <div class="footer-title">Verification Note</div>
                <p class="footer-text">This discharge summary is electronically generated by the G-MED 3.0 Orthopedic AI. The findings and advice must be verified by the operating surgeon or senior clinical resident prior to patient hand-over.</p>
            </div>
            <div class="footer-logo">G-MED 3.0</div>
        </div>
    </div>
    <script>
        if (window.navigator.userAgent.indexOf('iPhone') === -1 && window.navigator.userAgent.indexOf('iPad') === -1) {
            setTimeout(function() { window.print(); }, 800);
        }
    </script>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const patientNameCleanStr = p.demographics.name.replace(/[^a-zA-Z0-9]/g, '_');
        a.download = `Discharge_Summary_${patientNameCleanStr}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const renderDischargeSummary = (patient: OrthoPatient) => (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col h-full print:shadow-none print:border-none print-container max-w-4xl mx-auto overflow-hidden print:h-auto print:overflow-visible print:block">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3 print:hidden">
                {/* Meta Row: Auto-save status and Helpful tip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/55 dark:border-slate-700/50 pb-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <span className="bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded uppercase tracking-wider hidden sm:inline-block">Document Builder</span>
                        {autoSaveStatus === 'saving' && (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                <span className="text-blue-600">Auto-saving...</span>
                            </>
                        )}
                        {autoSaveStatus === 'saved' && (
                            <>
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                <span className="text-emerald-600 font-mono">Draft Auto-Saved {lastAutoSaveTime}</span>
                            </>
                        )}
                        {autoSaveStatus === 'idle' && lastAutoSaveTime && (
                            <span className="text-slate-400 font-mono text-[9px]">Saved at {lastAutoSaveTime}</span>
                        )}
                        {autoSaveStatus === 'idle' && !lastAutoSaveTime && (
                             <span className="text-slate-400 font-mono text-[9px] opacity-70">Ready. Changes auto-save.</span>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold italic leading-tight">
                        💡 Tip: Print blocked by frame? Open in a <span className="text-blue-600 dark:text-blue-400 font-black underline">new tab</span> or run <span className="text-emerald-600 dark:text-emerald-400 font-black">Export PDF</span>!
                    </p>
                </div>

                {/* Responsive Button Bar */}
                <div className="flex flex-wrap items-center gap-1.5 w-full">
                    {/* Position 1: Draft History Dropdown */}
                    <div className="relative flex-auto sm:flex-initial min-w-[110px] h-8">
                        <button 
                            onClick={() => setIsDischargeHistoryOpen(!isDischargeHistoryOpen)}
                            className="w-full h-full flex items-center justify-center gap-1 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-[10px]"
                        >
                            <History className="h-3.5 w-3.5 text-slate-500 shrink-0" /> 
                            <span className="truncate">Draft History</span>
                            {patient.dischargeDrafts && patient.dischargeDrafts.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-sm font-mono shrink-0">
                                    {patient.dischargeDrafts.length}
                                </span>
                            )}
                            <ChevronDown className="h-3 w-3 opacity-50 shrink-0 ml-auto" />
                        </button>
                        <AnimatePresence>
                            {isDischargeHistoryOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsDischargeHistoryOpen(false)}></div>
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                        exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                                        transition={{ duration: 0.15, ease: 'easeOut' }}
                                        className="absolute left-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800"
                                    >
                                        {/* Create and save draft inside relative dropdown container */}
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950/50">
                                        <button
                                            onClick={() => {
                                                const activeText = patient.dischargeNote || patient.soapNote || '';
                                                const newDraft = {
                                                    id: Date.now().toString(),
                                                    date: new Date().toLocaleString(),
                                                    content: activeText
                                                };
                                                const currentDrafts = patient.dischargeDrafts || [];
                                                if (currentDrafts.length > 0 && currentDrafts[currentDrafts.length - 1].content === activeText) {
                                                    alert("This draft is identical to the latest saved draft version.");
                                                    return;
                                                }
                                                updatePatient(patient.id, {
                                                    dischargeDrafts: [...currentDrafts, newDraft]
                                                });
                                            }}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm shadow-blue-500/10"
                                        >
                                            <Save className="h-3.5 w-3.5" /> Save Current as Draft
                                        </button>
                                    </div>

                                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                                        {patient.dischargeDrafts && patient.dischargeDrafts.length > 0 ? (
                                            patient.dischargeDrafts.map((draft, idx) => {
                                                const isActive = (patient.dischargeNote || '') === draft.content;
                                                const snippet = draft.content 
                                                    ? (draft.content.substring(0, 50) + (draft.content.length > 50 ? '...' : ''))
                                                    : 'Empty content';
                                                return (
                                                    <div 
                                                        key={draft.id}
                                                        className={`w-full group flex items-start justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isActive ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                                                    >
                                                        <button 
                                                            onClick={() => {
                                                                updatePatient(patient.id, { dischargeNote: draft.content });
                                                                setIsDischargeHistoryOpen(false);
                                                            }}
                                                            className="flex-1 text-left flex flex-col gap-1 pr-2 min-w-0"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Draft #{idx + 1}</span>
                                                                {isActive && (
                                                                    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded animate-pulse">
                                                                        <CheckCircle className="h-2.5 w-2.5" /> Active
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-mono leading-none">{draft.date}</span>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans italic line-clamp-2 mt-1">
                                                                "{snippet}"
                                                            </p>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm("Are you sure you want to delete this draft?")) {
                                                                    const updated = (patient.dischargeDrafts || []).filter(d => d.id !== draft.id);
                                                                    updatePatient(patient.id, { dischargeDrafts: updated });
                                                                }
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors self-start shrink-0 ml-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                            title="Delete Draft"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="px-4 py-6 text-xs text-slate-500 italic text-center">No saved versions yet. Write custom updates or generate detailed summaries to build draft history.</div>
                                        )}
                                    </div>
                                </motion.div>
                            </>
                        )}
                        </AnimatePresence>
                    </div>
                    {/* Position 2: Clear Summary */}
                    <button 
                       onClick={() => updatePatient(patient.id, { dischargeNote: undefined })}
                       className="flex-auto sm:flex-initial min-w-[110px] h-8 flex items-center justify-center gap-1 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold transition-all rounded hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm shrink-0"
                       title="Clear current discharge summary"
                    >
                       <Trash2 className="h-3.5 w-3.5 shrink-0" />
                       <span className="truncate">Clear Summary</span>
                    </button>

                    {/* Position 3: Copy Summary */}
                    <button 
                       onClick={() => handleCopySummary(patient)}
                       className={`flex-auto sm:flex-initial min-w-[110px] h-8 flex items-center justify-center gap-1 px-2 rounded border text-[10px] font-bold transition-all shrink-0 ${
                           copied 
                           ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400 shadow-sm animate-pulse' 
                           : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 shadow-sm'
                       }`}
                       title="Copy entire formatted text summary to EMR clipboard"
                    >
                        {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                        <span className="truncate">{copied ? 'Copied!' : 'Copy Summary'}</span>
                    </button>

                    {/* Position 4: Export PDF */}
                    <button 
                       onClick={() => handleExportHTML(patient)}
                       className="flex-auto sm:flex-initial min-w-[110px] h-8 flex items-center justify-center gap-1 px-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-sm hover:shadow-emerald-600/20 hover:-translate-y-0.5 transition-all font-bold text-[10px] shrink-0"
                       title="Download full document with self-contained printable design"
                    >
                        <Download className="h-3.5 w-3.5 shrink-0" /> 
                        <span className="truncate">Export PDF</span>
                    </button>

                    {/* Position 5: Final Print */}
                    <button 
                       onClick={() => {
                           if (window.self !== window.top) {
                               alert("Direct printing is sometimes restricted by your browser's preview frame settings. If native print fails to open, first click 'Open in a new tab' (top right), or use the 'Export PDF' button to download an auto-printing summary.");
                           }
                           window.print();
                       }}
                       className="flex-auto sm:flex-initial min-w-[110px] h-8 flex items-center justify-center gap-1 px-2 bg-[#0077b6] text-white rounded hover:bg-[#005f92] shadow-sm hover:shadow-[#0077b6]/20 hover:-translate-y-0.5 transition-all font-bold text-[10px] shrink-0"
                       title="Open standard browser print dialog"
                    >
                        <Printer className="h-3.5 w-3.5 shrink-0" /> 
                        <span className="truncate">Final Print</span>
                    </button>
                </div>
            </div>
            <div className="p-8 md:p-12 flex-1 overflow-auto print:overflow-visible bg-white dark:bg-slate-900">
                <div className="flex justify-between items-center border-b-[3px] border-[#0077b6] pb-4 mb-6">
                    <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-[#0077b6] text-white flex items-center justify-center flex-shrink-0 rounded-lg font-black text-base md:text-lg italic shadow-sm shadow-[#0077b6]/30">
                            GM
                        </div>
                        <div className="truncate">
                            <h2 className="text-lg md:text-xl font-black text-[#0077b6] uppercase tracking-tight italic leading-none truncate">Discharge Summary</h2>
                            <p className="text-[7px] md:text-[8px] font-mono text-slate-500 uppercase tracking-[0.1em] font-bold mt-1 truncate">G-MED 3.0 Clinical Management System / Dept. of Orthopaedics</p>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-base md:text-lg font-black text-slate-900 dark:text-white mb-0.5">{patient.demographics.sbhNumber}</div>
                        <div className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest">Document ID: {patient.id.slice(0, 4).toUpperCase()}</div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-8 mb-10 pb-8 border-b border-slate-100 dark:border-slate-800">
                    <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-4">
                         <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Patient Identity</span>
                            <div className="text-lg font-black text-slate-900 dark:text-white uppercase break-words flex items-baseline flex-wrap gap-x-2">
                                <div>
                                    {patient.demographics.rank && <span className="mr-1.5 text-sm font-bold text-slate-500">{patient.demographics.rank}</span>}
                                    {patient.demographics.name}
                                </div>
                                <span className="text-sm font-bold text-slate-500">{patient.demographics.age}y {patient.demographics.sex}</span>
                            </div>
                            {(patient.demographics.unit || patient.demographics.address) && (
                                <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                                    {[patient.demographics.unit, patient.demographics.address].filter(Boolean).join(' · ')}
                                </div>
                            )}
                        </div>
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Vital Statistics</span>
                            <div className="text-sm font-bold text-slate-900 dark:text-white uppercase">{patient.demographics.age} Yrs / {patient.demographics.sex}</div>
                        </div>
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Admission & Injury</span>
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase">
                                Bed: {patient.demographics.bedNumber} · ID: {patient.demographics.hospitalId}
                                {patient.demographics.computerNo && <span> · Comp: {patient.demographics.computerNo}</span>}
                            </div>
                            {patient.demographics.admissionDate && (
                                <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                                    Admitted: {new Date(patient.demographics.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </div>
                            )}
                            {(patient.moi || patient.injuryDate) && (
                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    {patient.moi && (
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                                            MOI: {patient.moi.startsWith("Other: ") ? patient.moi.replace("Other: ", "") : patient.moi}
                                        </div>
                                    )}
                                    {patient.injuryDate && (
                                        <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                                            Injury: {new Date(patient.injuryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            {patient.injuryTime && ` @ ${patient.injuryTime.startsWith("Custom: ") ? patient.injuryTime.replace("Custom: ", "") : patient.injuryTime}`}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Discharge Date</span>
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase italic underline decoration-slate-300 decoration-2">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3">Assessment Vitals</span>
                         <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-bold">BP</span>
                                <span className="font-black text-slate-900 dark:text-white">{patient.physicalExam?.vitals?.bp || '---'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-bold">PR</span>
                                <span className="font-black text-slate-900 dark:text-white">{patient.physicalExam?.vitals?.pulse || '---'} bpm</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-bold">SpO2</span>
                                <span className="font-black text-slate-900 dark:text-white">{patient.physicalExam?.vitals?.spo2 || '---'}%</span>
                            </div>
                         </div>
                    </div>
                </div>

                <div className="space-y-10">
                    <section>
                         <div className="flex items-center gap-3 mb-4">
                            <div className="h-0.5 bg-slate-900 dark:bg-white flex-1"></div>
                            <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] whitespace-nowrap">Diagnosis & Classification</h4>
                            <div className="h-0.5 bg-slate-900 dark:bg-white flex-1"></div>
                         </div>
                        <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xl font-black text-slate-900 dark:text-white uppercase leading-tight italic mb-3">
                                {patient.diagnosis}
                            </p>
                            {(patient.classification || patient.fractureType) && (
                                <div className="flex items-center gap-3 text-sm font-bold text-blue-700 dark:text-blue-400">
                                    <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded uppercase text-[10px]">Classification</div>
                                    <span>{patient.classification} {patient.fractureType && `[ Grade ${patient.fractureType} ]`}</span>
                                </div>
                            )}
                            {patient.comorbidities && patient.comorbidities.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 py-1">Comorbidities:</span>
                                    {patient.comorbidities.map(c => (
                                        <span key={c} className="text-[10px] font-bold px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg uppercase shadow-sm">{c}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {patient.surgicalProcedure && (
                        <section className="print:hidden">
                            <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] mb-4 text-center">Surgical Management</h4>
                            <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-2xl border border-green-100 dark:border-green-900/20 shadow-sm shadow-green-100 dark:shadow-none">
                                <p className="text-base font-black text-green-900 dark:text-green-400 uppercase leading-relaxed text-center">{patient.surgicalProcedure}</p>
                            </div>
                        </section>
                    )}

                    {/* Procedure Duration History Card */}
                    {patient.procedureDurationHistory && patient.procedureDurationHistory.length > 0 && (
                        <section className="print:hidden">
                            <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] mb-4 text-center">Procedural Duration Logs</h4>
                            <div className="bg-slate-50 dark:bg-slate-800/25 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-center divide-x divide-slate-205 dark:divide-slate-700">
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Logged Sessions</div>
                                        <div className="text-lg font-black text-[#0077b6]">{patient.procedureDurationHistory.length}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 font-sans">Total Duration</div>
                                        <div className="text-lg font-black text-slate-800 dark:text-slate-200 dark:text-slate-100 font-mono">
                                            {(() => {
                                                const totalSeconds = patient.procedureDurationHistory.reduce((acc, curr) => acc + curr.durationSeconds, 0);
                                                const hours = Math.floor(totalSeconds / 3600);
                                                const minutes = Math.floor((totalSeconds % 3600) / 60);
                                                return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                    {patient.procedureDurationHistory.map((history) => (
                                        <div key={history.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl text-xs space-y-1.5 text-left">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="space-y-0.5 text-left">
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{history.procedureName}</p>
                                                    <p className="text-[9px] text-slate-400 font-medium">{history.date}</p>
                                                </div>
                                                <span className="font-mono text-xs font-black text-slate-705 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800 shrink-0">
                                                    {(() => {
                                                        const m = Math.floor(history.durationSeconds / 60);
                                                        const s = history.durationSeconds % 60;
                                                        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                                    })()}
                                                </span>
                                            </div>
                                            {history.notes && (
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/40 p-1.5 rounded-lg border border-slate-200/40 dark:border-slate-800/50 italic leading-normal whitespace-pre-wrap">
                                                    {history.notes}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="mb-10 print:hidden">
                        <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] mb-4 italic underline underline-offset-4 decoration-2 decoration-slate-900">Hospital Briefing / Daily Course</h4>
                        <div className="bg-slate-50 dark:bg-slate-800/10 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm min-h-[120px] relative transition-all hover:bg-white dark:hover:bg-slate-800/20 group">
                             {isGeneratingSummary && (
                                 <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                                     <div className="flex flex-col items-center gap-3">
                                         <Loader2 className="h-8 w-8 text-[#0077b6] animate-spin" />
                                         <span className="text-xs font-black uppercase tracking-widest">Synthesizing Course...</span>
                                     </div>
                                 </div>
                             )}
                            <textarea 
                                value={patient.hospitalCourse || ''}
                                onChange={(e) => updatePatient(patient.id, { hospitalCourse: e.target.value })}
                                placeholder="Auto-summarize daily progress notes for a professional hospital course paragraph..."
                                className="w-full text-sm text-slate-700 dark:text-slate-300 leading-[1.8] font-bold p-0 bg-transparent border-none focus:ring-0 min-h-[120px] resize-none"
                            />
                            {!patient.hospitalCourse && (
                                <button 
                                    onClick={handleGenerateHospitalCourse}
                                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-900 hover:text-white transition-all opacity-0 group-hover:opacity-100 print:hidden"
                                >
                                    <Sparkles className="h-3.5 w-3.5" /> Synthesize Daily Progress
                                </button>
                            )}
                        </div>
                    </section>

                    <section className="mb-10">
                        <div className="flex justify-between items-end mb-4 pr-1">
                            <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] italic underline underline-offset-4 decoration-2 decoration-slate-900">Final Assessment / Outcome</h4>
                            {(patient.dischargeNote || patient.soapNote) && (
                                <button
                                    onClick={() => setIsEditingDischarge(!isEditingDischarge)}
                                    className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-200 dark:hover:text-white px-2 py-1 rounded font-bold uppercase tracking-wider transition-all print:hidden"
                                >
                                    {isEditingDischarge ? "View Styled" : "Edit Raw Text"}
                                </button>
                            )}
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm min-h-[150px] relative">
                             {isGeneratingSummary && (
                                 <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                                     <div className="flex flex-col items-center gap-3">
                                         <Loader2 className="h-8 w-8 text-[#0077b6] animate-spin" />
                                         <span className="text-xs font-black uppercase tracking-widest">Compiling Outcome...</span>
                                     </div>
                                 </div>
                             )}
                             {(!isEditingDischarge && (patient.dischargeNote || patient.soapNote)) ? (
                                <div className="markdown-body">
                                    <Markdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h2: ({node, ...props}) => <h2 className="text-lg font-black text-slate-800 dark:text-slate-200 dark:text-slate-100 mt-6 mb-3 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2" {...props} />,
                                            h3: ({node, ...props}) => <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-4 mb-2 uppercase" {...props} />,
                                            p: ({node, ...props}) => <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4 font-medium" {...props} />,
                                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 text-sm text-slate-700 dark:text-slate-300 font-medium" {...props} />,
                                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm text-slate-700 dark:text-slate-300 font-medium" {...props} />,
                                            table: ({node, ...props}) => <div className="overflow-x-auto mb-6"><table className="w-full text-left border-collapse text-sm" {...props} /></div>,
                                            th: ({node, ...props}) => <th className="bg-slate-50 dark:bg-slate-800/80 p-3 font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700" {...props} />,
                                            td: ({node, ...props}) => <td className="p-3 border-b border-slate-100 dark:border-slate-800/50 text-slate-700 dark:text-slate-300 align-top" {...props} />,
                                            strong: ({node, ...props}) => <strong className="font-black text-slate-900 dark:text-white" {...props} />
                                        }}
                                    >
                                        {patient.dischargeNote || patient.soapNote || ''}
                                    </Markdown>
                                </div>
                             ) : (
                                <textarea 
                                    value={patient.dischargeNote || patient.soapNote || ''}
                                    onChange={(e) => updatePatient(patient.id, { dischargeNote: e.target.value })}
                                    placeholder="Final clinical progress, state on discharge, etc..."
                                    className="w-full text-sm text-slate-700 dark:text-slate-300 leading-[1.8] font-mono whitespace-pre-wrap p-0 bg-transparent border-none focus:ring-0 min-h-[150px] resize-none"
                                />
                             )}
                            {!patient.dischargeNote && (
                                <button 
                                    onClick={handleGenerateDischargeSummary}
                                    className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#0077b6] transition-colors print:hidden"
                                >
                                    <Sparkles className="h-3.5 w-3.5" /> Generate Detailed Summary
                                </button>
                            )}
                        </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-8 print:hidden">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] mb-4">Medication & Advice</h4>
                            <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/20 shadow-sm h-full">
                                <div className="text-sm text-slate-800 dark:text-slate-200 font-bold leading-relaxed space-y-4">
                                     <div className="whitespace-pre-wrap">{patient.specialAdvice || 'Routine bone health medications, analgesia as needed, and strict limb elevation.'}</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] mb-4">Follow-up Plan</h4>
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/20 shadow-sm h-full">
                                <ul className="space-y-4">
                                    {patient.plan.filter(p => p.status === 'pending').map((p, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{idx + 1}</div>
                                            <span className="text-sm text-slate-800 dark:text-slate-200 font-bold leading-none">{p.text}</span>
                                        </li>
                                    ))}
                                    {patient.plan.filter(p => p.status === 'pending').length === 0 && (
                                        <li className="flex items-start gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                                            <span className="text-xs text-slate-500 italic font-bold">Review in Orthopaedic OPD with X-ray in 1 week.</span>
                                        </li>
                                    )}
                                    <li className="pt-4 mt-4 border-t border-blue-200/50 dark:border-blue-800 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Target Date</span>
                                        <input 
                                            type="date"
                                            value={patient.followUpDate || ''}
                                            onChange={(e) => updatePatient(patient.id, { followUpDate: e.target.value })}
                                            className="bg-white dark:bg-slate-900 text-xs font-bold p-1 rounded border border-blue-200 dark:border-blue-800 outline-none"
                                        />
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <div className="mt-32 pt-16 grid grid-cols-2 gap-20">
                        <div className="text-center">
                            <div className="h-0.5 bg-slate-900 dark:bg-white mb-3"></div>
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Treatment Team Resident</span>
                        </div>
                        <div className="text-center">
                            <div className="h-0.5 bg-slate-900 dark:bg-white mb-3"></div>
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Consultant Orthopaedic Surgeon</span>
                        </div>
                    </div>
                </div>
                
                <div className="mt-20 p-6 bg-[#001d36] text-white rounded-2xl flex items-center justify-between shadow-2xl overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-[9px] font-mono uppercase tracking-[0.5em] opacity-60 mb-2 font-bold">Verification Note</p>
                        <p className="text-[10px] font-bold italic leading-relaxed max-w-lg">
                            This discharge summary is electronically generated by the G-MED 3.0 Orthopedic AI. The findings and advice must be verified by the operating surgeon or senior clinical resident prior to patient hand-over.
                        </p>
                    </div>
                    <div className="text-right relative z-10">
                        <div className="text-2xl font-black italic opacity-20">G-MED 3.0</div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                </div>
            </div>
        </div>
    );

    const getOTCategory = (p: OrthoPatient): 'trauma' | 'arthroscopy' => {
        if (otOverrides[p.id]) return otOverrides[p.id];
        const textToTest = `${p.diagnosis} ${p.surgicalProcedure || ''}`.toUpperCase();
        if (
            textToTest.includes('ACL') ||
            textToTest.includes('PCL') ||
            textToTest.includes('MCL') ||
            textToTest.includes('LCL') ||
            textToTest.includes('TEAR') ||
            textToTest.includes('SLAP') ||
            textToTest.includes('DISLOCATION') ||
            textToTest.includes('SHOULDER') ||
            textToTest.includes('ARTHROSCOPIC') ||
            textToTest.includes('ARTHOLYSIS') ||
            textToTest.includes('ARTHROSCOPY') ||
            textToTest.includes('MENISCUS') ||
            textToTest.includes('DSAS') ||
            textToTest.includes('SS REPAIR') ||
            textToTest.includes('TENDINOSIS') ||
            textToTest.includes('RECURRENT SHOULDER')
        ) {
            return 'arthroscopy';
        }
        return 'trauma';
    };

    const renderOTList = () => {
        const filteredOTPatients = patients.filter(p => {
            const searchStr = `${p.demographics.name} ${p.demographics.sbhNumber} ${p.diagnosis} ${p.surgicalProcedure || ''} ${p.demographics.bedNumber || ''}`.toLowerCase();
            return searchStr.includes(otSearch.toLowerCase());
        });

        const traumaCases = filteredOTPatients.filter(p => getOTCategory(p) === 'trauma');
        const arthroscopyCases = filteredOTPatients.filter(p => getOTCategory(p) === 'arthroscopy');

        // Extract PAC status safely from investigations or plan
        const getPacInfo = (p: OrthoPatient) => {
            const val = p.investigations?.blood || '';
            const planText = p.plan?.map(item => item.text).join(' ') || '';
            const combined = `${val} ${planText}`.toUpperCase();

            let isAccepted = false;
            let detail = 'DUE';

            if (combined.includes('ACCEPTED') || combined.includes('APPROVED')) {
                isAccepted = true;
                detail = 'ACCEPTED';
            } else if (combined.includes('SITUS INVERSUS')) {
                detail = 'DUE USG ABDOMEN PELVICS R/O SITUS INVERSUS';
            } else if (combined.includes('BRADYCARDIA')) {
                detail = 'DUE NEED CARDIAC CLEARANCE FOR BRADYCARDIA';
            } else if (combined.includes('EOSINOPHILIA')) {
                detail = 'DUE EOSINOPHILIA RESOLVED / NEED REVIEW';
            } else if (combined.includes('CARDIAC AND CHEST Clearance')) {
                detail = 'DUE CARDIAC AND CHEST CLEARANCE';
            } else if (combined.includes('DOG BITE') || combined.includes('WOUND')) {
                detail = 'DUE WOUND ASSESSMENT & IMMUNIZATION CHECK';
            }

            return { isAccepted, detail };
        };

        const totalScheduled = filteredOTPatients.length;
        const totalAccepted = filteredOTPatients.filter(p => getPacInfo(p).isAccepted).length;
        const totalPending = totalScheduled - totalAccepted;

        const handleToggleCategory = (id: string, current: 'trauma' | 'arthroscopy') => {
            const nextCat = current === 'trauma' ? 'arthroscopy' : 'trauma';
            setOtOverrides({
                ...otOverrides,
                [id]: nextCat
            });
        };

        const getAnesthesia = (p: OrthoPatient) => {
            if (p.opAnesthesiaType) return p.opAnesthesiaType;
            const proc = (p.surgicalProcedure || '').toUpperCase();
            if (proc.includes('SLAP') || proc.includes('SHOULDER') || proc.includes('SUPRASPINATUS')) return 'BPB/GA';
            if (proc.includes('GANGLION') || proc.includes('EXCISION')) return 'LA';
            return 'SAB';
        };

        const getImplantText = (p: OrthoPatient) => {
            if (p.opImplantLot) return p.opImplantLot;
            const diag = p.diagnosis.toUpperCase();
            const proc = (p.surgicalProcedure || '').toUpperCase();
            if (diag.includes('ACL')) return 'KNEE ARTHROSCOPIC DRAPS';
            if (diag.includes('SHOULDER') || diag.includes('SUPRASPINATUS') || diag.includes('LATARJET')) return 'SHOULDER ARTHROSCOPIC DRAPS SET';
            if (diag.includes('GALAZZI') || diag.includes('GALEAZZI')) return 'DCP/LCP FOR RADIUS, CORTICAL SCREW, LOKING SCREW AND K-WIRE';
            if (diag.includes('PROXIMAL HUMERUS') || diag.includes('HUMERUS')) return 'PHILOS PROXIMAL HUMERUS LOCKING PLATE, 3.5 LOCKING SCREW, 3.5 CORTICAL SCREW AND K-WIRE';
            if (diag.includes('NOF') || diag.includes('NECK OF FEMUR') || diag.includes('SUBCAPITAL')) return 'CSS AND HRA SET';
            if (diag.includes('IT #') || diag.includes('INTERTROCHANTERIC') || diag.includes('PERTROCHANTERIC')) return 'PFNA2M, HELICAL BLADE DISTAL LOCKING SCREW AND DHS SET';
            if (diag.includes('SUPRACONDYLAR')) return 'DHLC, LOCKING SCREW AND CORTICAL SCREW.CCS AND K-WIRE';
            if (diag.includes('DISTAL RADIUS') || diag.includes('COLLES')) return 'Locking Plate, Locking Screws, Cortical Screws, K-wires.';
            if (diag.includes('ANKLE') || diag.includes('BIMALLEOLAR')) return 'Locking Plate, Locking Screws, Cortical Screws, K-wires.';
            if (proc.includes('K-WIRE')) return 'K-WIRE';
            return '';
        };

        const getResident = (p: OrthoPatient, idx: number) => {
            if (p.opSurgeon) return p.opSurgeon;
            const names = ['DR. SHYAM', 'DR. KUSHAL', 'DR. PRARTHA', 'DR. SHREE LAL', 'DR. LAXAM', 'DR. AAYUSH'];
            return names[idx % names.length];
        };

        const getOtNo = (p: OrthoPatient) => {
            if (p.otNumber) return p.otNumber;
            return getOTCategory(p) === 'arthroscopy' ? '6' : '7';
        };

        const getPacStatus = (p: OrthoPatient) => {
            if (p.pacStatus) return p.pacStatus;
            return getPacInfo(p).isAccepted ? 'FIT' : 'DUE';
        };

        const getDisplayDateHeader = () => {
            const match = otScheduleDate.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
            if (match) {
                return `${match[3]}/${match[2]}/${match[1]}`;
            }
            return '22/03/2083';
        };

        const renderSingleCategoryTable = (title: string, casesList: OrthoPatient[], isTrauma: boolean) => {
            return (
                <div className="space-y-2">
                    <div className="flex items-center justify-between border-b-2 border-slate-300 dark:border-slate-700 pb-1.5 mt-4">
                        <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 dark:text-slate-100 tracking-wider">{title}</span>
                        <span className="text-[10px] font-mono font-bold text-slate-500">{getDisplayDateHeader()}</span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-[11px] font-medium border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 uppercase tracking-wider text-[10px] font-black text-center">
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 w-8">SN</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 w-24">SBH/SBHF</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 w-16">RANK</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 w-36 text-left">PATIENT’S NAME</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 w-14">AGE/SEX</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 w-16">WARD</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 min-w-[150px] text-left">DIAGNOSIS</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 w-20">ANESTHESIA</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 min-w-[150px] text-left">PLAN</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 min-w-[120px] text-left">IMPLANTS</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 min-w-[100px] text-left">RESIDENTS</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 w-12">OT NO.</th>
                                    <th className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 w-14">PAC</th>
                                    <th className="py-2.5 px-2 w-10 text-center">ACT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {casesList.length > 0 ? (
                                    casesList.map((p, index) => {
                                        return (
                                            <tr 
                                                key={p.id} 
                                                onClick={() => {
                                                    if (!isInlineEditing) {
                                                        setSelectedPatientId(p.id);
                                                        setViewMode('list');
                                                    }
                                                }}
                                                className={`transition-colors text-center ${isInlineEditing ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer'}`}
                                            >
                                                {/* SN */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold font-mono text-slate-500">{index + 1}</td>
                                                
                                                {/* SBH/SBHF */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 font-mono font-bold">
                                                    {isInlineEditing ? (
                                                        <input 
                                                            type="text"
                                                            value={p.demographics.sbhNumber || ''}
                                                            onChange={(e) => updatePatient(p.id, {
                                                                demographics: { ...p.demographics, sbhNumber: e.target.value }
                                                            })}
                                                            className="w-full text-center bg-amber-50/40 dark:bg-amber-950/10 text-[11px] font-bold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none"
                                                        />
                                                    ) : (
                                                        p.demographics.sbhNumber || '-'
                                                    )}
                                                </td>
                                                
                                                {/* RANK */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 uppercase text-slate-500 font-bold">
                                                    {p.demographics.rank || 'CIVILIAN'}
                                                </td>
                                                
                                                {/* PATIENT NAME & MOBILE */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 text-left">
                                                    {isInlineEditing ? (
                                                        <div className="space-y-1">
                                                            <input 
                                                                type="text"
                                                                value={p.demographics.name || ''}
                                                                onChange={(e) => updatePatient(p.id, {
                                                                    demographics: { ...p.demographics, name: e.target.value }
                                                                })}
                                                                className="w-full bg-amber-50/40 dark:bg-amber-950/10 text-[11px] font-extrabold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none uppercase"
                                                            />
                                                            <input 
                                                                type="text"
                                                                value={p.demographics.mobile || ''}
                                                                onChange={(e) => updatePatient(p.id, {
                                                                    demographics: { ...p.demographics, mobile: e.target.value }
                                                                })}
                                                                placeholder="Mobile"
                                                                className="w-full bg-amber-50/40 dark:bg-amber-950/10 text-[9px] font-mono p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="font-extrabold text-slate-900 dark:text-slate-100 uppercase">
                                                            <span>{p.demographics.name}</span>
                                                            {p.demographics.mobile && (
                                                                <span className="block text-[8.5px] font-mono font-medium text-slate-400 normal-case mt-0.5">{p.demographics.mobile}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                
                                                {/* AGE/SEX */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-600 dark:text-slate-300">
                                                    {p.demographics.age}Y/{p.demographics.sex}
                                                </td>
                                                
                                                {/* WARD */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 font-black">
                                                    {isInlineEditing ? (
                                                        <input 
                                                            type="text"
                                                            value={p.demographics.bedNumber || ''}
                                                            onChange={(e) => updatePatient(p.id, {
                                                                demographics: { ...p.demographics, bedNumber: e.target.value }
                                                            })}
                                                            className="w-full text-center bg-amber-50/40 dark:bg-amber-950/10 text-[11px] font-bold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none"
                                                        />
                                                    ) : (
                                                        p.demographics.bedNumber?.toUpperCase() === 'OPD' || p.demographics.bedNumber?.toUpperCase() === 'PED' ? p.demographics.bedNumber.toUpperCase() : `SII ${p.demographics.bedNumber}`
                                                    )}
                                                </td>
                                                
                                                {/* DIAGNOSIS */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 text-left font-mono font-bold uppercase text-[10px] leading-tight">
                                                    {isInlineEditing ? (
                                                        <textarea 
                                                            value={p.diagnosis || ''}
                                                            onChange={(e) => updatePatient(p.id, { diagnosis: e.target.value })}
                                                            rows={2}
                                                            className="w-full bg-amber-50/40 dark:bg-amber-950/10 text-[10px] font-mono font-bold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none resize-none uppercase"
                                                        />
                                                    ) : (
                                                        p.diagnosis
                                                    )}
                                                </td>
                                                
                                                {/* ANESTHESIA */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-amber-600 dark:text-amber-400">
                                                    {isInlineEditing ? (
                                                        <input 
                                                            type="text"
                                                            value={p.opAnesthesiaType || getAnesthesia(p)}
                                                            onChange={(e) => updatePatient(p.id, { opAnesthesiaType: e.target.value })}
                                                            className="w-full text-center bg-amber-50/40 dark:bg-amber-950/10 text-[10px] font-mono font-bold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none"
                                                        />
                                                    ) : (
                                                        getAnesthesia(p)
                                                    )}
                                                </td>
                                                
                                                {/* PLAN */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 text-left font-extrabold uppercase text-[10px] leading-tight text-[#0077b6] dark:text-sky-400">
                                                    {isInlineEditing ? (
                                                        <textarea 
                                                            value={p.surgicalProcedure || ''}
                                                            onChange={(e) => updatePatient(p.id, { surgicalProcedure: e.target.value })}
                                                            rows={2}
                                                            className="w-full bg-amber-50/40 dark:bg-amber-950/10 text-[10px] font-bold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none resize-none uppercase text-[#0077b6]"
                                                        />
                                                    ) : (
                                                        p.surgicalProcedure || 'SURGICAL RECON'
                                                    )}
                                                </td>
                                                
                                                {/* IMPLANTS */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 text-left font-bold text-slate-500 text-[10px] leading-tight">
                                                    {isInlineEditing ? (
                                                        <textarea 
                                                            value={p.opImplantLot || getImplantText(p)}
                                                            onChange={(e) => updatePatient(p.id, { opImplantLot: e.target.value })}
                                                            rows={2}
                                                            className="w-full bg-amber-50/40 dark:bg-amber-950/10 text-[10px] font-bold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none resize-none uppercase"
                                                        />
                                                    ) : (
                                                        getImplantText(p) || '-'
                                                    )}
                                                </td>
                                                
                                                {/* RESIDENTS */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 text-left font-bold text-slate-600 dark:text-slate-400 text-[10px] leading-tight">
                                                    {isInlineEditing ? (
                                                        <input 
                                                            type="text"
                                                            value={p.opSurgeon || getResident(p, index)}
                                                            onChange={(e) => updatePatient(p.id, { opSurgeon: e.target.value })}
                                                            className="w-full bg-amber-50/40 dark:bg-amber-950/10 text-[10px] font-bold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none uppercase"
                                                        />
                                                    ) : (
                                                        getResident(p, index)
                                                    )}
                                                </td>
                                                
                                                {/* OT NO. */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-center">
                                                    {isInlineEditing ? (
                                                        <input 
                                                            type="text"
                                                            value={p.otNumber || getOtNo(p)}
                                                            onChange={(e) => updatePatient(p.id, { otNumber: e.target.value })}
                                                            className="w-full text-center bg-amber-50/40 dark:bg-amber-950/10 text-[11px] font-mono font-bold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none"
                                                        />
                                                    ) : (
                                                        getOtNo(p)
                                                    )}
                                                </td>
                                                
                                                {/* PAC */}
                                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 font-black">
                                                    {isInlineEditing ? (
                                                        <input 
                                                            type="text"
                                                            value={p.pacStatus || getPacStatus(p)}
                                                            onChange={(e) => updatePatient(p.id, { pacStatus: e.target.value })}
                                                            className="w-full text-center bg-amber-50/40 dark:bg-amber-950/10 text-[10px] font-bold p-1 rounded border border-amber-200 dark:border-amber-900 focus:outline-none uppercase"
                                                        />
                                                    ) : (
                                                        <span className={getPacStatus(p) === 'FIT' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400 animate-pulse'}>
                                                            {getPacStatus(p)}
                                                        </span>
                                                    )}
                                                </td>
                                                
                                                {/* ACT */}
                                                <td className="py-2 px-2 text-center">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedPatientId(p.id);
                                                            setViewMode('list');
                                                        }}
                                                        className="p-1 bg-[#0077b6]/5 text-[#0077b6] dark:bg-sky-500/10 dark:text-sky-400 hover:bg-[#0077b6] hover:text-white dark:hover:bg-sky-400 dark:hover:text-slate-900 rounded-lg cursor-pointer transition-all"
                                                        title="Inspect EMR Case File"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={14} className="py-8 text-center text-slate-400 italic font-medium">No patients found in this category.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        };

        return (
            <div className="flex-1 overflow-auto p-4 md:p-6 bg-[#E4E3E0] dark:bg-slate-950 font-sans print:bg-white print:p-0">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Official Hospital Header (Styled similarly to standard paper medical registers) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm text-center relative overflow-hidden print:border-0 print:shadow-none print:p-0">
                        {/* Status lines removed to focus purely on professional hospital header layout */}
                        <div className="relative z-10 max-w-4xl mx-auto">
                            <h2 className="text-sm font-black text-[#0077b6] tracking-widest uppercase mb-1 font-mono">NEPAL ARMY MEDICAL CORPS</h2>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                                SHREE BIRENDRA HOSPITAL (OT LIST - UNIT I)
                            </h1>
                            <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-xs font-black text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 max-w-lg mx-auto leading-normal">
                                <span className="text-[#0077b6] dark:text-sky-400 font-mono text-sm">DATE: {otScheduleDate}</span>
                                <span className="h-4 w-px bg-slate-200 dark:bg-slate-800"></span>
                                <span>ROOM: MAIN OPERATION THEATRE (UNIT I)</span>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                                <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-2">Surgical Unit Roster</span>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                                    <span className="text-[#0077b6] dark:text-sky-400">SURGEONS:</span> {otSurgeonsRoster}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Operational Statistics Bento Widgets */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Scheduled</span>
                            <div className="text-2xl font-black text-[#0077b6] mt-1">{totalScheduled} Cases</div>
                            <span className="text-[10px] font-medium text-slate-500">Unit-I Live List</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Trauma & Recon</span>
                            <div className="text-2xl font-black text-amber-600 mt-1">{traumaCases.length} Cases</div>
                            <span className="text-[10px] font-medium text-slate-500">Auto-Classified</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Arthroscopy & Sports</span>
                            <div className="text-2xl font-black text-sky-600 mt-1">{arthroscopyCases.length} Cases</div>
                            <span className="text-[10px] font-medium text-slate-500">Auto-Classified</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">PAC Clearances</span>
                            <div className="text-2xl font-black text-green-600 mt-1">{totalAccepted} Accepted</div>
                            <span className="text-[10px] font-medium text-slate-500">{totalPending} Pending/Due</span>
                        </div>
                    </div>

                    {/* Control Bar for View Switching, Searching and Printing */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden shrink-0">
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
                            <button
                                onClick={() => setOtViewType('board')}
                                className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${otViewType === 'board' ? 'bg-[#0077b6] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-200 dark:hover:text-slate-200'}`}
                            >
                                <LayoutDashboard className="h-3.5 w-3.5" />
                                <span>Interactive Boards</span>
                            </button>
                            <button
                                onClick={() => setOtViewType('spreadsheet')}
                                className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${otViewType === 'spreadsheet' ? 'bg-[#0077b6] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-200 dark:hover:text-slate-200'}`}
                            >
                                <ClipboardList className="h-3.5 w-3.5" />
                                <span>Hospital Spreadsheet</span>
                            </button>
                        </div>

                        {/* Search field */}
                        <div className="flex-1 max-w-md relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={otSearch}
                                onChange={(e) => setOtSearch(e.target.value)}
                                placeholder="Filter schedule by Patient Name, Bed, SBH#, or Diagnosis..."
                                className="w-full pl-9 pr-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-[#0077b6] focus:ring-1 focus:ring-[#0077b6]"
                            />
                        </div>

                        {/* Tool actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => window.print()}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                            >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Print Schedule</span>
                            </button>
                        </div>
                    </div>

                    {/* Render corresponding view */}
                    {otViewType === 'board' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
                            {/* TRAUMA & GENERAL ORTHOPEDICS COLUMN */}
                            <div className="bg-slate-100/50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 dark:text-slate-100 uppercase tracking-wider">
                                            TRAUMA & RECONSTRUCTION ({traumaCases.length})
                                        </h3>
                                    </div>
                                    <span className="text-[9.5px] font-black uppercase text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/65 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">AUTO</span>
                                </div>

                                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                                    {traumaCases.length > 0 ? (
                                        traumaCases.map(p => {
                                            const pac = getPacInfo(p);
                                            return (
                                                <div 
                                                    key={p.id} 
                                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-[#0077b6] dark:hover:border-blue-700 transition-all space-y-4 relative group"
                                                >
                                                    {/* Card Header row */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            <span className="text-[9px] font-extrabold px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-md border border-amber-100 dark:border-amber-900/35 font-mono">
                                                                WARD S-II {p.demographics.bedNumber}
                                                            </span>
                                                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md font-mono">
                                                                Ref: {p.demographics.sbhNumber}
                                                            </span>
                                                        </div>
                                                        <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest">{p.demographics.rank}</span>
                                                    </div>

                                                    {/* Patient Name */}
                                                    <div>
                                                        <h4 className="text-base font-black text-slate-900 dark:text-white uppercase leading-none tracking-tight">
                                                            {p.demographics.name}
                                                        </h4>
                                                        <span className="text-[10px] font-bold text-slate-405 dark:text-slate-400 mt-1.5 block">Age/Sex: {p.demographics.age}Y / {p.demographics.sex}</span>
                                                    </div>

                                                    {/* Diagnosis */}
                                                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/65">
                                                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">ORTHOPEDIC DIAGNOSIS</span>
                                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100 uppercase leading-normal tracking-tight">
                                                            {p.diagnosis}
                                                        </p>
                                                    </div>

                                                    {/* Surgical Plan */}
                                                    <div>
                                                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#0077b6] block mb-1">PLANNED SURGICAL PROCEDURE</span>
                                                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight tracking-tight">
                                                            {p.surgicalProcedure || 'STAGED DEBRIDEMENT / REDUCTION'}
                                                        </p>
                                                    </div>

                                                    {/* Surgical Anesthesia Badge & PAC Date */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] uppercase font-bold text-slate-400">Anesthesia:</span>
                                                            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#0077b6]/10 text-[#0077b6] dark:text-sky-400 rounded-md font-mono uppercase">
                                                                {p.plan?.map(it=>it.text).join(' ').includes('SAB') || p.diagnosis.includes('CLOSED') ? 'SAB' : 'GA / SAB'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* PAC Status Check badge */}
                                                    <div className={`p-2.5 rounded-lg border text-xs font-semibold flex items-start gap-2 ${pac.isAccepted ? 'bg-green-50/60 dark:bg-green-950/20 border-green-150 dark:border-green-900/30 text-green-800 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-950/20 border-orange-150 dark:border-orange-900/35 text-orange-850 dark:text-orange-400'}`}>
                                                        {pac.isAccepted ? (
                                                            <CheckCircle className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
                                                        ) : (
                                                            <Clock className="h-4 w-4 shrink-0 text-orange-500 mt-0.5 animate-pulse" />
                                                        )}
                                                        <div>
                                                            <div className="font-extrabold uppercase text-[10px]">PAC STATUS: {pac.isAccepted ? 'CLEARED' : 'PENDING'}</div>
                                                            <p className="text-[10.5px] font-medium leading-normal mt-0.5 opacity-90">{pac.detail}</p>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPatientId(p.id);
                                                                setViewMode('list');
                                                            }}
                                                            className="flex-1 py-1.5 px-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-255 rounded-lg text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                                        >
                                                            <span>Open Patient Record</span>
                                                            <ChevronRight className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleCategory(p.id, 'trauma')}
                                                            className="py-1.5 px-2.5 border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                                                            title="Toggle to Arthroscopy column"
                                                        >
                                                            Move column
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-slate-400 italic text-center py-10">No trauma cases scheduled.</p>
                                    )}
                                </div>
                            </div>

                            {/* ARTHROSCOPY & SPORTS MEDICINE COLUMN */}
                            <div className="bg-sky-50/20 dark:bg-slate-900/10 border border-sky-100 dark:border-slate-800 p-4 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between border-b border-sky-200/50 dark:border-slate-800 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 dark:text-slate-100 uppercase tracking-wider">
                                            ARTHROSCOPY & SPORTS MEDICINE ({arthroscopyCases.length})
                                        </h3>
                                    </div>
                                    <span className="text-[9.5px] font-black uppercase text-sky-600 font-mono bg-sky-50 dark:bg-sky-950/20 px-2 py-0.5 rounded border border-sky-100 dark:border-sky-900/35">AUTO</span>
                                </div>

                                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                                    {arthroscopyCases.length > 0 ? (
                                        arthroscopyCases.map(p => {
                                            const pac = getPacInfo(p);
                                            return (
                                                <div 
                                                    key={p.id} 
                                                    className="bg-white dark:bg-slate-900 border border-sky-100/60 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-[#0077b6] dark:hover:border-sky-500 transition-all space-y-4 relative group"
                                                >
                                                    {/* Card Header row */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            <span className="text-[9px] font-extrabold px-2 py-0.5 bg-sky-50 dark:bg-sky-950/20 text-[#0077b6] dark:text-sky-400 rounded-md border border-sky-100/70 dark:border-sky-900/35 font-mono">
                                                                WARD S-II {p.demographics.bedNumber}
                                                            </span>
                                                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md font-mono">
                                                                Ref: {p.demographics.sbhNumber}
                                                            </span>
                                                        </div>
                                                        <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest">{p.demographics.rank}</span>
                                                    </div>

                                                    {/* Patient Name */}
                                                    <div>
                                                        <h4 className="text-base font-black text-slate-900 dark:text-white uppercase leading-none tracking-tight">
                                                            {p.demographics.name}
                                                        </h4>
                                                        <span className="text-[10px] font-bold text-slate-405 dark:text-slate-400 mt-1.5 block">Age/Sex: {p.demographics.age}Y / {p.demographics.sex}</span>
                                                    </div>

                                                    {/* Diagnosis */}
                                                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/65">
                                                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">ORTHOPEDIC DIAGNOSIS</span>
                                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100 uppercase leading-normal tracking-tight">
                                                            {p.diagnosis}
                                                        </p>
                                                    </div>

                                                    {/* Surgical Plan */}
                                                    <div>
                                                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#0077b6] block mb-1">PLANNED SURGICAL PROCEDURE</span>
                                                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight tracking-tight">
                                                            {p.surgicalProcedure || 'DIAGNOSTIC KNEE ARTHROSCOPY'}
                                                        </p>
                                                    </div>

                                                    {/* Surgical Anesthesia Badge & PAC Date */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] uppercase font-bold text-slate-400">Anesthesia:</span>
                                                            <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-50/65 text-[#0077b6] dark:text-sky-400 rounded-md font-mono uppercase">
                                                                {p.surgicalProcedure?.includes('SLAP') || p.surgicalProcedure?.includes('SHOULDER') ? 'BPB' : 'SAB'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* PAC Status Check badge */}
                                                    <div className={`p-2.5 rounded-lg border text-xs font-semibold flex items-start gap-2 ${pac.isAccepted ? 'bg-green-50/60 dark:bg-green-950/20 border-green-150 dark:border-green-900/30 text-green-800 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-950/20 border-orange-150 dark:border-orange-900/35 text-orange-850 dark:text-orange-400'}`}>
                                                        {pac.isAccepted ? (
                                                            <CheckCircle className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
                                                        ) : (
                                                            <Clock className="h-4 w-4 shrink-0 text-orange-500 mt-0.5 animate-pulse" />
                                                        )}
                                                        <div>
                                                            <div className="font-extrabold uppercase text-[10px]">PAC STATUS: {pac.isAccepted ? 'CLEARED' : 'PENDING'}</div>
                                                            <p className="text-[10.5px] font-medium leading-normal mt-0.5 opacity-90">{pac.detail}</p>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPatientId(p.id);
                                                                setViewMode('list');
                                                            }}
                                                            className="flex-1 py-1.5 px-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-255 rounded-lg text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                                        >
                                                            <span>Open Patient Record</span>
                                                            <ChevronRight className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleCategory(p.id, 'arthroscopy')}
                                                            className="py-1.5 px-2.5 border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                                                            title="Toggle to Trauma column"
                                                        >
                                                            Move column
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-slate-400 italic text-center py-10">No arthroscopy cases scheduled.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* CLASSIC OFFICIAL SPREADSHEET LAYOUT - CUSTOMIZABLE & WYSIWYG */
                        <div className="space-y-6 print:hidden">
                            {/* Editable Configurations Panel */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Spreadsheet & Roster Settings</span>
                                    <button 
                                        onClick={() => {
                                            setOtScheduleDate('2083/03/22 (MONDAY)');
                                            setOtSurgeonsRoster('COL.DR. NIRAB KAYASTHA/LT.COL.DR.RITESH SINHA/LT. COL. DR RAVI BHANDARI/LT. COL. DR MOHIT THAPA MAGAR/MAJ. DR. AMIR RATNA SHAKYA/MAJ.KISORE KHATTR/MAJ. DR. BIRAJ KC');
                                        }}
                                        className="text-[10px] font-black uppercase text-[#0077b6] hover:underline cursor-pointer"
                                    >
                                        Reset to Default
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Roster Date Header</label>
                                        <input 
                                            type="text"
                                            value={otScheduleDate}
                                            onChange={(e) => setOtScheduleDate(e.target.value)}
                                            className="w-full text-xs font-bold p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0077b6] focus:ring-1 focus:ring-[#0077b6] text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Surgeons List (Slashes Separated)</label>
                                        <input 
                                            type="text"
                                            value={otSurgeonsRoster}
                                            onChange={(e) => setOtSurgeonsRoster(e.target.value)}
                                            className="w-full text-xs font-bold p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0077b6] focus:ring-1 focus:ring-[#0077b6] text-slate-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <div className="space-y-0.5 pr-4">
                                        <div className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 dark:text-slate-100">Direct Spreadsheet Editing</div>
                                        <div className="text-[10px] text-slate-500 leading-normal">Enable this to edit SBH Numbers, Name/Mobile, Wards, Plans, Implants, and PAC status directly on the spreadsheet cells.</div>
                                    </div>
                                    <button
                                        onClick={() => setIsInlineEditing(!isInlineEditing)}
                                        className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all cursor-pointer border shrink-0 ${isInlineEditing ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'}`}
                                    >
                                        {isInlineEditing ? '✏️ Disable Editing' : '✏️ Enable Spreadsheet Editing'}
                                    </button>
                                </div>
                            </div>

                            {/* Spreadsheet Canvas */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
                                <div className="text-center mb-8 border-b border-dashed border-slate-200 dark:border-slate-800 pb-6">
                                    <h3 className="text-xs font-black tracking-widest text-[#0077b6] uppercase mb-1 font-mono">NEPAL ARMY MEDICAL CORPS</h3>
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">SHREE BIRENDRA HOSPITAL</h2>
                                    <h1 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mt-1">
                                        “OT LIST - UNIT-I” FOR {otScheduleDate}
                                    </h1>
                                    <p className="text-[10px] font-black text-slate-500 uppercase mt-2 max-w-3xl mx-auto leading-relaxed">
                                        SURGEON: {otSurgeonsRoster}
                                    </p>
                                </div>

                                {renderSingleCategoryTable('ARTHROSCOPIC CASES', arthroscopyCases, false)}
                                {renderSingleCategoryTable('TRAUMA CASES', traumaCases, true)}

                                {/* Signature Block on Screen */}
                                <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row justify-between gap-8 text-xs font-bold leading-normal">
                                    <div className="space-y-8">
                                        <div className="w-48 border-t border-slate-300 dark:border-slate-700"></div>
                                        <p className="uppercase text-[9px] text-slate-400 font-black">PREPARED BY (RESIDENT ASSISTANT)</p>
                                    </div>
                                    <div className="space-y-8">
                                        <div className="w-48 border-t border-slate-300 dark:border-slate-700"></div>
                                        <p className="uppercase text-[9px] text-slate-400 font-black">VERIFIED BY (CHIEF RESIDENT / ATTENDING)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ALWAYS RENDER A FULL LANDSCAPE PRINT-OPTIMIZED WORK-STATION SCHEDULE FOR HARDCOPY PRINTING */}
                    <div className="hidden print:block bg-white text-black p-0 border-0 font-sans" style={{ fontSize: '10px' }}>
                        <div className="text-center mb-6">
                            <h3 className="text-[11px] font-black tracking-widest uppercase mb-1 font-mono">NEPAL ARMY MEDICAL CORPS</h3>
                            <h2 className="text-lg font-black uppercase">SHREE BIRENDRA HOSPITAL</h2>
                            <h1 className="text-xl font-bold uppercase tracking-tight leading-normal">OPERATING THEATRE SCHEDULE - UNIT I</h1>
                            <div className="text-xs font-bold uppercase mt-2 border-y border-black py-1.5 max-w-lg mx-auto flex items-center justify-center gap-4">
                                <span>DATE: 2083/02/18 (MONDAY)</span>
                                <span>ROOM: MAIN OT (UNIT I)</span>
                            </div>
                            <p className="text-xs font-bold uppercase mt-3">
                                <strong>Surgeons:</strong> Col. Dr. Nirab Kayastha / Lt. Col. Dr. Ritesh Sinha / Lt. Col. Dr. Ravi Bhandari / Lt. Col. Dr. Mohit Thapa Magar / Maj. Dr. Amir R. Shakya / Maj. Dr. Biraj KC
                            </p>
                        </div>

                        <table className="w-full border-collapse border border-black text-[9.5px]">
                            <thead>
                                <tr className="bg-gray-150 font-bold uppercase border-b border-black text-center">
                                    <th className="border border-black p-1 w-6">SN</th>
                                    <th className="border border-black p-1 w-14">SBH#</th>
                                    <th className="border border-black p-1 w-16">RANK</th>
                                    <th className="border border-black p-1 w-16">DOA</th>
                                    <th className="border border-black p-1 w-32">PATIENT’S NAME</th>
                                    <th className="border border-black p-1 w-12">AGE/SEX</th>
                                    <th className="border border-black p-1 w-14">WARD</th>
                                    <th className="border border-black p-1">DIAGNOSIS</th>
                                    <th className="border border-black p-1 w-12">ANESTH.</th>
                                    <th className="border border-black p-1">PLAN</th>
                                    <th className="border border-black p-1 w-32">PAC REMARKS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.map((p, ix) => {
                                    const pac = getPacInfo(p);
                                    return (
                                        <tr key={p.id} className="text-center">
                                            <td className="border border-black p-1 font-mono text-center">{ix + 1}</td>
                                            <td className="border border-black p-1 font-mono">{p.demographics.sbhNumber}</td>
                                            <td className="border border-black p-1 uppercase text-left">{p.demographics.rank || 'CIVILIAN'}</td>
                                            <td className="border border-black p-1 font-mono">{p.demographics.admissionDate || '26/02/2083'}</td>
                                            <td className="border border-black p-1 font-bold text-left uppercase">{p.demographics.name}</td>
                                            <td className="border border-black p-1 font-mono">{p.demographics.age}Y/{p.demographics.sex}</td>
                                            <td className="border border-black p-1 text-center font-bold">SII {p.demographics.bedNumber}</td>
                                            <td className="border border-black p-1 text-left uppercase leading-normal font-mono" style={{ fontSize: '9px' }}>{p.diagnosis}</td>
                                            <td className="border border-black p-1 font-mono uppercase">{p.surgicalProcedure?.includes('SLAP') || p.surgicalProcedure?.includes('SHOULDER') ? 'BPB' : 'SAB'}</td>
                                            <td className="border border-black p-1 text-left uppercase font-bold" style={{ fontSize: '9px' }}>{p.surgicalProcedure || 'definitive fix'}</td>
                                            <td className="border border-black p-1 text-left uppercase" style={{ fontSize: '9px' }}>{pac.detail}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="mt-12 flex justify-between items-start text-xs font-bold leading-normal">
                            <div className="space-y-12">
                                <div className="w-48 border-t border-black"></div>
                                <p className="text-center uppercase text-[10px]">PREPARED BY (RESIDENT ASSISTANT)</p>
                            </div>
                            <div className="space-y-12">
                                <div className="w-48 border-t border-black"></div>
                                <p className="text-center uppercase text-[10px]">VERIFIED BY (CHIEF RESIDENT / ATTENDING)</p>
                            </div>
                        </div>

                        {/* Standard formal safety warning footer */}
                        <div className="mt-8 text-center text-[9px] font-bold text-gray-500 uppercase py-2 border-t border-dashed border-gray-400">
                            * AI-Generated Clinical Rounding Roster Summary. Verification against official military chart log is strictly required before theatre dispatch.
                        </div>
                    </div>

                    {/* Interactive Safety disclaimer as mandated by Rule AGENTS_md */}
                    <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 text-sky-800 dark:text-sky-300 p-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 tracking-wide text-center leading-relaxed print:hidden">
                        <AlertTriangle className="h-4 w-4 text-[#0077b6] dark:text-sky-400 shrink-0" />
                        <span>AI-generated schedule dashboard. Must be verified and cross-referenced with Resident/Attending sheet before theatre pre-op checklists.</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderWardDuties = () => (
        <div className="flex-1 overflow-auto p-6 bg-[#F8FAFC] dark:bg-slate-950">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Ward Workflow</h2>
                        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-1">Daily Resident Duties & Follow-ups</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-blue-500" /> Morning Checklist
                            </h3>
                            <div className="space-y-4">
                                {DAILY_WARD_DUTIES.map(duty => {
                                    const isDone = wardDuties.includes(duty);
                                    return (
                                        <button 
                                            key={duty}
                                            onClick={() => {
                                                const next = isDone ? wardDuties.filter(d => d !== duty) : [...wardDuties, duty];
                                                setWardDuties(next);
                                            }}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left
                                                ${isDone 
                                                    ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60' 
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400 shadow-sm'
                                                }`}
                                        >
                                            <span className={`text-sm font-bold ${isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{duty}</span>
                                            {isDone ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Clock className="h-5 w-5 text-slate-300" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-[#0077b6] text-white rounded-2xl p-6 shadow-xl">
                            <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-80">Quick Stats</h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-[10px] uppercase font-bold opacity-60 block">Ward Completion</span>
                                    <div className="text-2xl font-black">{Math.round((wardDuties.length / DAILY_WARD_DUTIES.length) * 100)}%</div>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold opacity-60 block">Remaining Tasks</span>
                                    <div className="text-2xl font-black">{DAILY_WARD_DUTIES.length - wardDuties.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
    const renderWardSummary = () => {
        // Count patient statuses
        const statusCounts = PATIENT_STATUSES.reduce((acc, status) => {
            acc[status] = 0;
            return acc;
        }, {} as Record<string, number>);

        patients.forEach(p => {
            if (statusCounts[p.status] !== undefined) {
                statusCounts[p.status]++;
            } else {
                const found = PATIENT_STATUSES.find(s => s.toLowerCase() === p.status.toLowerCase());
                if (found) {
                    statusCounts[found]++;
                } else {
                    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
                }
            }
        });

        const chartData = Object.entries(statusCounts)
            .filter(([_, count]) => count > 0)
            .map(([status, count]) => {
                let shortLabel = status;
                if (status === "Pre-Op Workup") shortLabel = "Pre-Op Work";
                else if (status === "Planned for OT") shortLabel = "Plan OT";
                else if (status === "Conservative Management") shortLabel = "Cons. Mgmt";
                else if (status === "Ready for Discharge") shortLabel = "Discharge";
                else if (status.startsWith("Post-Op Day ")) {
                    shortLabel = status.replace("Post-Op Day ", "POD ");
                }
                return {
                    status: shortLabel,
                    fullStatus: status,
                    count
                };
            });

        // Top KPI Calculations
        const occupied = patients.length;
        const capacityData = [
            { name: 'Occupied', value: occupied, fill: '#0ea5e9' },
            { name: 'Available', value: Math.max(0, 30 - occupied), fill: '#e2e8f0' }
        ];

        const upcomingCount = patients.filter(p => ['Pre-Op Workup', 'Planned for OT'].includes(p.status)).length;
        const otherCount = Math.max(0, occupied - upcomingCount);
        const surgeryData = upcomingCount === 0 && otherCount === 0 
            ? [{ name: 'None', value: 1, fill: '#f1f5f9' }]
            : [
                { name: 'Upcoming', value: upcomingCount, fill: '#f59e0b' },
                { name: 'Other', value: otherCount, fill: '#fef3c7' }
            ];

        const labTasks = patients.flatMap(p => p.plan.filter(item => /(lab|blood|x-?ray|mri|ct|investigation|cbc|usg|ecg)/i.test(item.text)));
        const pendingLabs = labTasks.filter(t => t.status === 'pending').length;
        const doneLabs = labTasks.filter(t => t.status === 'done').length;
        const emptyLabs = pendingLabs === 0 && doneLabs === 0;
        const labData = emptyLabs 
            ? [{ name: 'None', value: 1, fill: '#f1f5f9' }] 
            : [
                { name: 'Pending', value: pendingLabs, fill: '#ef4444' },
                { name: 'Done', value: doneLabs, fill: '#fee2e2' }
            ];

        const renderMiniDonut = (data: any[]) => (
            <div className="w-16 h-16 shrink-0 z-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            innerRadius={20}
                            outerRadius={28}
                            stroke="none"
                            isAnimationActive={true}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );

        return (
            <div className="flex-1 overflow-auto p-6 bg-[#E4E3E0] dark:bg-slate-950 font-sans">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Ward Briefing</h2>
                            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-1">Live Clinical Inventory / {patients.length} Cases</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Last Sync</span>
                                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">{new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Dashboard KPI Top Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* KPI Card 1: Capacity */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-905 dark:border-slate-800 shadow-[8px_8px_0px_0px_rgba(0,119,182,0.1)] p-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest uppercase mb-1 flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5 text-sky-500" /> Ward Capacity
                                </h3>
                                <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                                    {occupied} <span className="text-sm text-slate-400 font-mono">/ 30 Beds</span>
                                </div>
                            </div>
                            {renderMiniDonut(capacityData)}
                        </div>
                        
                        {/* KPI Card 2: Upcoming Surgeries */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-905 dark:border-slate-800 shadow-[8px_8px_0px_0px_rgba(245,158,11,0.1)] p-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest uppercase mb-1 flex items-center gap-1">
                                    <Scissors className="h-3.5 w-3.5 text-amber-500" /> Upcoming Surgeries
                                </h3>
                                <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                                    {upcomingCount} <span className="text-sm text-slate-400 font-mono">Cases</span>
                                </div>
                            </div>
                            {renderMiniDonut(surgeryData)}
                        </div>

                        {/* KPI Card 3: Pending Labs */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-905 dark:border-slate-800 shadow-[8px_8px_0px_0px_rgba(239,68,68,0.1)] p-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest uppercase mb-1 flex items-center gap-1">
                                    <Droplets className="h-3.5 w-3.5 text-red-500" /> Pending Labs Total
                                </h3>
                                <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                                    {pendingLabs} <span className="text-sm text-slate-400 font-mono">Results</span>
                                </div>
                            </div>
                            {renderMiniDonut(labData)}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* Table View Component - takes 2 columns on desktops */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-slate-900 border border-slate-905 dark:border-slate-800 shadow-[8px_8px_0px_0px_rgba(0,119,182,0.1)] overflow-hidden">
                                <div className="p-4 border-b border-slate-900 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                                    <h3 className="text-[10px] font-black text-slate-900 dark:text-white tracking-wider uppercase flex items-center gap-1.5">
                                        <ClipboardList className="h-4 w-4 text-[#0077b6]" /> Active Patient Census
                                    </h3>
                                    <span className="text-[9px] font-mono select-none px-2 py-0.5 bg-slate-900 text-white rounded font-bold uppercase">
                                        {patients.length} Active Bed Slots
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#0077b6] text-white border-b border-[#005f92]">
                                                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] italic">Bed</th>
                                                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] italic">Patient Identity</th>
                                                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] italic">Clinical Diagnosis</th>
                                                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] italic">Physiology / Status</th>
                                                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] italic">Critical Plan</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                            {patients.map(p => (
                                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => { setSelectedPatientId(p.id); setViewMode('list'); }}>
                                                    <td className="p-4 align-top">
                                                        <span className="inline-block px-2 py-1 bg-[#0077b6] text-white text-[10px] font-mono font-bold">
                                                            {p.demographics.bedNumber}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                                            {p.demographics.name}
                                                            {p.dangerSigns && p.dangerSigns.length > 0 && (
                                                                <div className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                                                            )}
                                                            {p.quickNotes && p.quickNotes.trim().length > 0 && (
                                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest leading-none font-sans ${
                                                                    p.quickNotesCategory === 'Urgent'
                                                                        ? 'text-rose-600 dark:text-rose-450 bg-rose-50 dark:bg-rose-950/20 border-rose-150 dark:border-rose-900/40'
                                                                        : p.quickNotesCategory === 'Routine'
                                                                        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30'
                                                                        : 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20 border-sky-100 dark:border-sky-900/30'
                                                                }`} title={`Quick Notes Priority: ${p.quickNotesCategory || 'General'}`}>
                                                                    <FileText className={`h-2.5 w-2.5 ${
                                                                        p.quickNotesCategory === 'Urgent' ? 'text-rose-500' : p.quickNotesCategory === 'Routine' ? 'text-amber-500' : 'text-sky-500'
                                                                    }`} /> {p.quickNotesCategory === 'Urgent' ? 'Urgent' : p.quickNotesCategory === 'Routine' ? 'Routine' : 'General'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] font-mono text-slate-500 mt-1 uppercase">
                                                            {p.demographics.age}Y · {p.demographics.sex} · {p.demographics.sbhNumber}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 align-top min-w-[200px]">
                                                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed italic">
                                                            {p.diagnosis}
                                                        </div>
                                                        {p.comorbidities && p.comorbidities.length > 0 && (
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {p.comorbidities.map(c => (
                                                                    <span key={c} className="text-[8px] px-1 border border-slate-200 text-slate-500 uppercase">{c}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <div className="text-[11px] font-black text-[#0077b6] uppercase tracking-wider mb-2">{p.status}</div>
                                                        {p.physicalExam?.vitals && (
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500 uppercase">
                                                                <span>BP: <b className="text-slate-900 dark:text-slate-300">{p.physicalExam.vitals.bp}</b></span>
                                                                <span>HR: <b className="text-slate-900 dark:text-slate-300">{p.physicalExam.vitals.pulse}</b></span>
                                                                <span>O2: <b className="text-slate-900 dark:text-slate-300">{p.physicalExam.vitals.spo2}%</b></span>
                                                                <span>T: <b className="text-slate-900 dark:text-slate-300">{p.physicalExam.vitals.temp}</b></span>
                                                            </div>
                                                        )}
                                                        {p.status.toLowerCase().includes('pre-op') && p.preOpChecklist && (
                                                            <div className="mt-3">
                                                                <div className="flex items-center justify-between text-[8px] font-black text-orange-600 uppercase mb-1">
                                                                    <span>Pre-Op Gap</span>
                                                                    <span>{Math.round((p.preOpChecklist.length / PRE_OP_CHECKLIST.length) * 100)}%</span>
                                                                </div>
                                                                <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-orange-500" style={{ width: `${(p.preOpChecklist.length / PRE_OP_CHECKLIST.length) * 100}%` }} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 align-top">
                                                        <div className="space-y-1.5">
                                                            {p.plan.filter(i => i.status === 'pending').slice(0, 3).map(item => (
                                                                <div key={item.id} className="flex items-center gap-2 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                                                                    <div className="w-1.5 h-1.5 bg-amber-500 shrink-0" />
                                                                    <span className="truncate">{item.text}</span>
                                                                </div>
                                                            ))}
                                                            {p.plan.filter(i => i.status === 'pending').length > 3 && (
                                                                <div className="text-[9px] font-black text-[#0077b6] uppercase pl-3">
                                                                    + {p.plan.filter(i => i.status === 'pending').length - 3} Additional Tasks
                                                                </div>
                                                            )}
                                                            {p.plan.filter(i => i.status === 'pending').length === 0 && (
                                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-green-600 uppercase">
                                                                    <CheckCircle className="h-3 w-3" /> Ready
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Status Distribution Recharts Column (takes 1 column on desktops) */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-slate-900 border border-slate-900 dark:border-slate-800 p-5 shadow-[8px_8px_0px_0px_rgba(0,119,182,0.1)]">
                                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-[#0077b6]" /> Patient Status Distribution
                                </h3>

                                <div className="h-[210px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                            <XAxis 
                                                dataKey="status" 
                                                tick={{ fontSize: 9, fontWeight: 'bold' }} 
                                                axisLine={false} 
                                                tickLine={false} 
                                            />
                                            <YAxis 
                                                allowDecimals={false} 
                                                tick={{ fontSize: 9, fontWeight: 'bold' }} 
                                                axisLine={false} 
                                                tickLine={false} 
                                            />
                                            <Tooltip 
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-slate-900 dark:bg-slate-800 text-white p-2.5 text-[11px] font-bold rounded-lg shadow-md border border-slate-800">
                                                                <div className="uppercase tracking-widest text-slate-400 text-[9px] mb-0.5">{data.fullStatus}</div>
                                                                <div className="text-sky-400">{data.count} Patient{data.count !== 1 ? 's' : ''}</div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={25}>
                                                {chartData.map((entry, index) => {
                                                    let color = '#3b82f6'; // default blue
                                                    const fsLower = entry.fullStatus.toLowerCase();
                                                    if (fsLower.includes('pre-op')) color = '#f97316'; // orange
                                                    else if (fsLower.includes('planned for ot')) color = '#8b5cf6'; // purple
                                                    else if (fsLower.includes('post-op')) color = '#a855f7'; // lighter purple
                                                    else if (fsLower.includes('discharge')) color = '#10b981'; // green
                                                    else if (fsLower.includes('conservative')) color = '#475569'; // slate
                                                    return <Cell key={`cell-${index}`} fill={color} />;
                                                })}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Dynamic Indicator Badges Legend */}
                                <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                                    <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 select-none">Units Status Breakdown</h4>
                                    {chartData.map((item, idx) => {
                                        let dotColor = 'bg-blue-500';
                                        let textColor = 'text-blue-500 dark:text-blue-400';
                                        const fsLower = item.fullStatus.toLowerCase();
                                        if (fsLower.includes('pre-op')) {
                                            dotColor = 'bg-orange-500';
                                            textColor = 'text-orange-500 dark:text-orange-400';
                                        } else if (fsLower.includes('planned for ot')) {
                                            dotColor = 'bg-purple-600';
                                            textColor = 'text-purple-600 dark:text-purple-400';
                                        } else if (fsLower.includes('post-op')) {
                                            dotColor = 'bg-purple-400';
                                            textColor = 'text-purple-400 dark:text-purple-300';
                                        } else if (fsLower.includes('discharge')) {
                                            dotColor = 'bg-green-500';
                                            textColor = 'text-green-500 dark:text-green-400';
                                        } else if (fsLower.includes('conservative')) {
                                            dotColor = 'bg-slate-600';
                                            textColor = 'text-slate-600 dark:text-slate-400';
                                        }
                                        return (
                                            <div key={idx} className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                                    <span className={`w-2 h-2 rounded-full ${dotColor}`} /> 
                                                    {item.fullStatus}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 dark:bg-slate-800/80 ${textColor}`}>
                                                    {item.count} Patient{item.count !== 1 ? 's' : ''} ({Math.round((item.count / patients.length) * 100)}%)
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Advisory Insight Banner */}
                            <div className="bg-slate-900 border border-slate-900 p-5 shadow-[8px_8px_0px_0px_rgba(0,119,182,0.15)] text-white">
                                <span className="text-[10px] font-black text-sky-400 tracking-[0.1em] block mb-2 uppercase select-none">Unit Density Insights</span>
                                <p className="text-[11px] leading-relaxed text-slate-300 font-medium">
                                    The ward currently runs at <strong className="text-white">{patients.length} active beds</strong>. 
                                    Pre-operative and Planned OT cases account for <strong className="text-orange-400">{patients.filter(p => p.status.toLowerCase().includes('pre-op') || p.status.toLowerCase().includes('ot')).length} beds</strong>.
                                    Check clearance and ensure all consents, blood arrangements, and necessary implants are verified before tomorrow's surgical schedule.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,119,182,0.05)]">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Total Census</span>
                            <div className="text-4xl font-black text-slate-900 dark:text-white italic">{patients.length}</div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,119,182,0.05)]">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Pending Tasks</span>
                            <div className="text-4xl font-black text-amber-500 italic">
                                {patients.reduce((acc, p) => acc + p.plan.filter(i => i.status === 'pending').length, 0)}
                            </div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,119,182,0.05)]">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Pre-Op List</span>
                            <div className="text-4xl font-black text-blue-600 italic">
                                {patients.filter(p => p.status.toLowerCase().includes('pre-op')).length}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderQuickAccessMenu = (patient: OrthoPatient) => {
        if (!patient) return null;

        const QUICK_HANDOVER_SUGGESTIONS = [
            "⚠️ Monitor distal neurovascular status (DNA) Q4H",
            "🐾 Elevate leg on pillow (Strict elevation)",
            "🩹 Wound dressing check / drainage check tomorrow",
            "💧 Maintain active IV fluids / antibiotic schedule",
            "💊 Pin-site cleaning daily with spirit & check for discharge",
            "🥛 Keep NPO from midnight for upcoming surgical procedure",
            "📊 Check Post-Op blood counts (Hb) in the morning",
            "🩻 Check post-reduction X-ray"
        ];

        return (
            <>
                {/* Floating Quick Entry Toggle Menu */}
                <div id="quick-fab-menu" className="fixed bottom-6 right-6 z-40 print:hidden flex flex-col gap-2 w-auto items-end">
                    {/* Active handover notification pill */}
                    {patient.nurseHandover && (
                        <div className="bg-emerald-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-md animate-pulse">
                            Active Handover Set
                        </div>
                    )}
                    
                    <button
                        onClick={() => openQuickMenu('progress', patient)}
                        className="flex items-center gap-2 px-3.5 py-2.5 bg-[#0c4a6e] hover:bg-[#083550] text-white rounded-lg font-bold text-xs shadow-md transition-all text-left outline-none cursor-pointer border border-sky-900/30"
                    >
                        <Plus className="h-3.5 w-3.5" /> Quick SOAP Progress
                    </button>
                    
                    <button
                        onClick={() => openQuickMenu('handover', patient)}
                        className="flex items-center gap-2 px-3.5 py-2.5 bg-[#0077b6] hover:bg-[#005f92] text-white rounded-lg font-bold text-xs shadow-md transition-all text-left outline-none cursor-pointer border border-blue-800/30"
                    >
                        <Users className="h-3.5 w-3.5" /> Quick Shift Handover
                    </button>

                    <button
                        onClick={() => openQuickMenu('stopwatch', patient)}
                        className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold text-xs shadow-md transition-all text-left outline-none cursor-pointer border border-slate-700/30"
                    >
                        <Clock className="h-3.5 w-3.5" /> Procedure Stopwatch
                    </button>
                </div>

                {/* Drawers / Overlays */}
                {isQuickMenuOpen && (
                    <div 
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end print:hidden cursor-pointer"
                        onClick={() => setIsQuickMenuOpen(false)}
                    >
                        {/* Slide-over Drawer Pane */}
                        <div 
                            className="w-full sm:w-[500px] bg-slate-50 dark:bg-slate-900 h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800 cursor-default animate-slide-in"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Drawer Header */}
                            <div className="bg-white dark:bg-slate-800 p-5 border-b border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black bg-[#0077b6] text-white px-2 py-0.5 rounded">
                                                Bed {patient.demographics.bedNumber}
                                            </span>
                                            <span className="text-xs text-slate-400 font-bold">#{patient.demographics.sbhNumber}</span>
                                        </div>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                                            {patient.demographics.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 truncate max-w-[325px]">{patient.diagnosis}</p>
                                    </div>
                                    <button 
                                        onClick={() => setIsQuickMenuOpen(false)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Drawer Tab Selector */}
                                <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
                                    <button
                                        onClick={() => setQuickMenuTab('progress')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${quickMenuTab === 'progress' ? 'bg-white dark:bg-slate-800 text-[#0077b6] shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:text-slate-200 dark:hover:text-slate-300'}`}
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Daily Progress (SOAP)
                                    </button>
                                    <button
                                        onClick={() => setQuickMenuTab('handover')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${quickMenuTab === 'handover' ? 'bg-white dark:bg-slate-800 text-[#0077b6] shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:text-slate-200 dark:hover:text-slate-300'}`}
                                    >
                                        <Users className="h-3.5 w-3.5" /> Nurse Shift Handover
                                    </button>
                                    <button
                                        onClick={() => setQuickMenuTab('stopwatch')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${quickMenuTab === 'stopwatch' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:text-slate-200 dark:hover:text-slate-300'}`}
                                    >
                                        <Clock className="h-3.5 w-3.5" /> Stopwatch Timer
                                    </button>
                                </div>
                            </div>

                            {/* Drawer Core form area */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                                {quickMenuTab === 'progress' ? (
                                    <div className="space-y-4">
                                        <div className="bg-white dark:bg-slate-805 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                                            <h4 className="text-[10px] font-black text-[#0077b6] uppercase tracking-widest flex items-center justify-between">
                                                <span>Objective Vitals</span>
                                                <button
                                                    onClick={() => {
                                                        // pull active patient vitals if they exist
                                                        setQuickBP(patient.physicalExam?.vitals?.bp || '');
                                                        setQuickPulse(patient.physicalExam?.vitals?.pulse ? String(patient.physicalExam.vitals.pulse) : '');
                                                        setQuickSpO2(patient.physicalExam?.vitals?.spo2 ? String(patient.physicalExam.vitals.spo2) : '');
                                                        setQuickTemp(patient.physicalExam?.vitals?.temp ? String(patient.physicalExam.vitals.temp) : '');
                                                    }}
                                                    className="text-[9px] lowercase underline hover:text-[#005f92] text-slate-400 capitalize transition-colors"
                                                >
                                                    sync from patient record
                                                </button>
                                            </h4>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">Blood Pressure</label>
                                                    <input 
                                                        type="text"
                                                        value={quickBP}
                                                        onChange={(e) => setQuickBP(e.target.value)}
                                                        placeholder="e.g. 120/80"
                                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">Pulse (bpm)</label>
                                                    <input 
                                                        type="number"
                                                        value={quickPulse}
                                                        onChange={(e) => setQuickPulse(e.target.value)}
                                                        placeholder="e.g. 78"
                                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">Oxygen Saturation (%)</label>
                                                    <input 
                                                        type="number"
                                                        value={quickSpO2}
                                                        onChange={(e) => setQuickSpO2(e.target.value)}
                                                        placeholder="e.g. 98"
                                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">Temperature (°F)</label>
                                                    <input 
                                                        type="number"
                                                        step="0.1"
                                                        value={quickTemp}
                                                        onChange={(e) => setQuickTemp(e.target.value)}
                                                        placeholder="e.g. 98.4"
                                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Subjective (Symptom / Shift Updates)</label>
                                                <textarea
                                                    value={quickSubjective}
                                                    onChange={(e) => setQuickSubjective(e.target.value)}
                                                    placeholder="Describe current complaints: pain levels, sleep, bowel habits..."
                                                    className="w-full p-3 text-xs bg-white dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6] min-h-[60px]"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Objective (Local Examination / Dressing)</label>
                                                <textarea
                                                    value={quickObjective}
                                                    onChange={(e) => setQuickObjective(e.target.value)}
                                                    placeholder="Wound dry/intact, active drainage, distal neurovascular status, swelling status..."
                                                    className="w-full p-3 text-xs bg-white dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6] min-h-[60px]"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Assessment (Current diagnosis & focus)</label>
                                                <input
                                                    type="text"
                                                    value={quickAssessment}
                                                    onChange={(e) => setQuickAssessment(e.target.value)}
                                                    placeholder="e.g. Post-Op Day 2, stable"
                                                    className="w-full p-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6] font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Plan</label>
                                                <textarea
                                                    value={quickPlanText}
                                                    onChange={(e) => setQuickPlanText(e.target.value)}
                                                    placeholder="Mobilization details, drug modifications, planned investigations..."
                                                    className="w-full p-3 text-xs bg-white dark:bg-slate-800 border border-slate-205 dark:border-slate-705 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6] min-h-[60px]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : quickMenuTab === 'handover' ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Shift Handover & Special Instructions</label>
                                            <textarea
                                                value={quickHandoverText}
                                                onChange={(e) => setQuickHandoverText(e.target.value)}
                                                placeholder="Write specific shift handover instructions for active ward nursing staff..."
                                                className="w-full p-4 text-xs bg-white dark:bg-slate-800 border border-[#0077b6]/35 dark:border-[#0077b6]/45 rounded-xl outline-none focus:ring-1 focus:ring-[#0077b6] min-h-[140px] font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100"
                                            />
                                        </div>

                                        {/* Clickable Quick Tags */}
                                        <div>
                                            <label className="text-[10px] font-black text-[#0077b6] uppercase mb-2 block">⚡ Instant Resident Tags (Tap to append)</label>
                                            <div className="flex flex-wrap gap-2">
                                                {QUICK_HANDOVER_SUGGESTIONS.map((s, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            const existing = quickHandoverText.trim();
                                                            setQuickHandoverText(existing ? `${existing}\n- ${s}` : `- ${s}`);
                                                        }}
                                                        className="text-[9px] font-bold px-2.5 py-1.5 bg-slate-100 hover:bg-[#0077b6]/10 hover:text-[#0077b6] dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 transition-all text-left cursor-pointer resize-none"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Historic handover notes */}
                                        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-4">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                                <History className="h-3.5 w-3.5 text-slate-500" /> Handover Logs History
                                            </h4>
                                            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                                                {patient.nurseHandovers && patient.nurseHandovers.length > 0 ? (
                                                    patient.nurseHandovers.map(h => (
                                                        <div key={h.id} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3 rounded-lg text-xs space-y-1">
                                                            <div className="flex justify-between text-[9px] text-slate-400">
                                                                <span className="font-bold text-slate-500">{new Date(h.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                                <span className="uppercase font-semibold">{h.addedBy}</span>
                                                            </div>
                                                            <p className="font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{h.text}</p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 italic text-center py-4">No historic handover logs found.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <ProcedureTimer patient={patient} updatePatient={updatePatient} />
                                    </div>
                                )}
                            </div>

                            {/* Drawer Footer Actions */}
                            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-3 print:hidden">
                                <button
                                    onClick={() => setIsQuickMenuOpen(false)}
                                    className="flex-1 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 rounded-lg transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                {quickMenuTab === 'progress' ? (
                                    <button
                                        onClick={() => handleSaveQuickProgress(patient.id)}
                                        className="flex-1 py-2.5 text-xs font-bold bg-[#0077b6] hover:bg-[#005f92] text-white rounded-lg transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Save SOAP Note
                                    </button>
                                ) : quickMenuTab === 'handover' ? (
                                    <button
                                        onClick={() => handleSaveQuickHandover(patient.id)}
                                        className="flex-1 py-2.5 text-xs font-bold bg-[#0077b6] hover:bg-[#005f92] text-white rounded-lg transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <Users className="h-3.5 w-3.5" /> Save Handover
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsQuickMenuOpen(false)}
                                        className="flex-1 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <CheckCircle className="h-3.5 w-3.5" /> Done / Close Stopwatch
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    };

    const renderDashboard = () => {
        const dashboardCards = [
            { id: 'total-admitted', name: 'Total Admitted', icon: Users, count: patients.length, bg: 'bg-blue-50 dark:bg-blue-950/15', text: 'text-[#0077b6] dark:text-sky-400', desc: 'Active beds census' },
            { id: 'newly-admitted', name: 'Newly Admitted', icon: PlusCircle, count: patients.filter(p => p.demographics.admissionDate).length, bg: 'bg-emerald-50 dark:bg-emerald-950/15', text: 'text-emerald-600 dark:text-emerald-400', desc: 'Admissions this cycle' },
            { id: 'under-evaluation', name: 'Under Evaluation', icon: ClipboardList, count: patients.filter(p => p.status.toLowerCase().includes('evaluation') || p.status.toLowerCase().includes('eval') || p.status.toLowerCase().includes('workup')).length, bg: 'bg-amber-50 dark:bg-amber-950/15', text: 'text-amber-600 dark:text-amber-400', desc: 'Pre-op diagnostics' },
            { id: 'conservative', name: 'Conservative Mgt', icon: Heart, count: patients.filter(p => p.status.toLowerCase().includes('conservative')).length, bg: 'bg-teal-50 dark:bg-teal-950/15', text: 'text-teal-600 dark:text-teal-400', desc: 'Non-surgical care' },
            { id: 'pre-operative', name: 'Pre-operative', icon: AlertCircle, count: patients.filter(p => p.status.toLowerCase().includes('pre-op') || p.status.toLowerCase().includes('workup')).length, bg: 'bg-sky-50 dark:bg-sky-950/15', text: 'text-[#0077b6] dark:text-sky-300', desc: 'Planned surgical cases' },
            { id: 'pac-pending', name: 'PAC Pending', icon: ShieldAlert, count: patients.filter(p => (p.status.toLowerCase().includes('pre-op') || p.status.toLowerCase().includes('workup')) && p.pacStatus !== 'FIT' && p.pacStatus !== 'Accepted' && p.pacStatus !== 'Fit').length, bg: 'bg-rose-50 dark:bg-rose-950/15', text: 'text-rose-600 dark:text-rose-400', desc: 'Anesthesia clearances' },
            { id: 'ot-planned', name: 'OT Planned', icon: Scissors, count: patients.filter(p => !!p.otNumber || p.plan.some(it => /ot|surgery|orif|crif/i.test(it.text))).length, bg: 'bg-indigo-50 dark:bg-indigo-950/15', text: 'text-indigo-600 dark:text-indigo-400', desc: 'Scheduled surgeries' },
            { id: 'post-operative', name: 'Post-operative', icon: CheckSquare, count: patients.filter(p => p.status.toLowerCase().includes('post-op')).length, bg: 'bg-green-50 dark:bg-green-950/15', text: 'text-green-600 dark:text-green-400', desc: 'Recovering patients' },
            { id: 'discharge-planned', name: 'Discharge Planned', icon: Home, count: patients.filter(p => p.status.toLowerCase().includes('discharge') || p.status.toLowerCase().includes('ready')).length, bg: 'bg-purple-50 dark:bg-purple-950/15', text: 'text-purple-600 dark:text-purple-400', desc: 'Awaiting transition' },
            { id: 'urgent-tasks', name: 'Urgent Tasks', icon: AlertTriangle, count: patients.filter(p => p.quickNotesCategory === 'Urgent' || p.tasks?.some(t => t.priority === 'Urgent' && t.status === 'pending')).length, bg: 'bg-red-50 dark:bg-red-950/15', text: 'text-red-600 dark:text-red-400', desc: 'High-priority actions' },
            { id: 'ot-tomorrow', name: 'OT Tomorrow', icon: Calendar, count: patients.filter(p => p.status.toLowerCase().includes('pre-op') || !!p.otNumber).length, bg: 'bg-violet-50 dark:bg-violet-950/15', text: 'text-violet-600 dark:text-violet-400', desc: 'Active list' },
            { id: 'consult-pending', name: 'Consult Pending', icon: Stethoscope, count: patients.filter(p => p.plan.some(it => /consult/i.test(it.text)) || p.consultStatus === 'Requested').length, bg: 'bg-orange-50 dark:bg-orange-950/15', text: 'text-orange-600 dark:text-orange-400', desc: 'Specialty evaluations' },
            { id: 'investigation-pending', name: 'Investigations Pending', icon: Activity, count: patients.filter(p => p.investigations?.structuredList?.some(i => i.status === 'Send' || i.status === 'Sample Sent' || i.status === 'Report Pending') || p.plan.some(it => /(lab|blood|x-?ray)/i.test(it.text))).length, bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/15', text: 'text-fuchsia-600 dark:text-fuchsia-400', desc: 'Lab & radiology queue' }
        ];

        return (
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-y-auto font-sans">
                {/* 1. Quick Manager Navigation */}
                <div className="mb-6">
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3 font-mono">
                        ★ G-MED Quick Services
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                            onClick={() => {
                                setViewMode('list');
                                setActiveFilter(null);
                                setSelectedPatientId(null);
                            }}
                            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 hover:border-[#0077b6]/40 hover:shadow-md transition-all active:scale-95 group cursor-pointer text-left"
                        >
                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-[#0077b6] group-hover:bg-[#0077b6] group-hover:text-white transition-all shrink-0">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Ward Census</span>
                                <span className="text-[10px] text-slate-400">View & edit patients</span>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                setViewMode('ot-list');
                            }}
                            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 hover:border-[#0077b6]/40 hover:shadow-md transition-all active:scale-95 group cursor-pointer text-left"
                        >
                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-[#0077b6] group-hover:bg-[#0077b6] group-hover:text-white transition-all shrink-0">
                                <Scissors className="h-5 w-5" />
                            </div>
                            <div>
                                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">OT List</span>
                                <span className="text-[10px] text-slate-400">Familiar printable sheet</span>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                setViewMode('ward-duties');
                            }}
                            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 hover:border-[#0077b6]/40 hover:shadow-md transition-all active:scale-95 group cursor-pointer text-left"
                        >
                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-[#0077b6] group-hover:bg-[#0077b6] group-hover:text-white transition-all shrink-0">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <div>
                                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Task Manager</span>
                                <span className="text-[10px] text-slate-400">Intern & resident checklists</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* 2. Interactive Redesigned Dashboard Cards */}
                <div>
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3 font-mono">
                        📊 Ward Census Analytics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                        {dashboardCards.map((card) => {
                            const IconComp = card.icon;
                            return (
                                <button
                                    key={card.id}
                                    onClick={() => {
                                        setViewMode('list');
                                        setActiveFilter(card.id);
                                        setSelectedPatientId(null);
                                    }}
                                    className={`bg-white dark:bg-slate-900 p-4 rounded-xl border ${activeFilter === card.id ? 'border-[#0077b6] ring-1 ring-[#0077b6]' : 'border-slate-200 dark:border-slate-800/80'} shadow-xs hover:border-[#0077b6]/30 hover:shadow-md transition-all active:scale-95 flex flex-col items-start text-left gap-3 relative overflow-hidden group cursor-pointer min-h-[115px]`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className={`p-2 rounded-lg ${card.bg} ${card.text} transition-all group-hover:scale-110`}>
                                            <IconComp className="h-4.5 w-4.5 stroke-[2]" />
                                        </div>
                                        <div className="text-xl md:text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                                            {card.count}
                                        </div>
                                    </div>
                                    <div className="mt-1">
                                        <div className="text-xs font-black text-slate-800 dark:text-slate-200 leading-snug">
                                            {card.name}
                                        </div>
                                        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-0.5 font-mono">
                                            {card.desc}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 absolute bottom-3 right-3 text-slate-300 group-hover:text-[#0077b6] group-hover:translate-x-1 transition-all" />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Ward Pulse Card */}
                <div className="mt-8 bg-blue-50/40 dark:bg-slate-900/40 p-4 rounded-xl border border-blue-100/50 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="h-4 w-4 text-[#0077b6]" /> G-MED Ward Pulse
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
                            Ward capacity: <b>{Math.round((patients.length / 30) * 100)}%</b>. Active pre-op clearance workflows in process: <b>{patients.filter(p => p.status.toLowerCase().includes('pre-op')).length} cases</b>. Post-operative telemetry monitors: <b>{patients.filter(p => p.status.toLowerCase().includes('post-op')).length} active</b>.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setIsAddingPatient(true);
                            setViewMode('list');
                        }}
                        className="py-2 px-3 bg-[#0077b6] hover:bg-[#005f92] text-white text-[11px] font-extrabold uppercase rounded-lg shadow-sm border border-[#0077b6]/25 transition-colors cursor-pointer shrink-0"
                    >
                        + Admit New Case
                    </button>
                </div>
            </div>
        );
    };

    const renderPatientHub = (patient: OrthoPatient) => {
        const modules = [
            { id: 'demographics', label: 'Demographics', icon: Users, desc: 'Patient identity, age, sex, phone and comorbidities', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'diagnosis', label: 'Diagnosis', icon: Activity, desc: 'Primary orthopedic diagnosis, comorbidity registry & SOAP note', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'history_exam', label: 'History & Examination', icon: Stethoscope, desc: 'Review of systems, physical exam, and specific ortho tests', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'investigations', label: 'Investigation', icon: ClipboardList, desc: 'Blood count, dynamic Hb trend tracker, and X-ray interpretation', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'pac', label: 'PAC', icon: ClipboardList, desc: 'Pre-operative anesthesia checkup, checklists & clearances', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'consultation', label: 'Consultation', icon: Users, desc: 'Referral letters, cardiology/internal medicine clearance records', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'ot_plan', label: 'OT Plan', icon: Scissors, desc: 'Planned surgical procedure, technique, approach & scheduled times', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'operation', label: 'Operation', icon: Zap, desc: 'Intra-operative notes, implants, lot numbers & tourniquet log', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'post_op', label: 'Post-op', icon: Clock, desc: 'Post-operative checks, pulses, POD checklist & Hb levels', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'discharge', label: 'Discharge', icon: FileText, desc: 'Discharge summary drafts, hospital course and advice', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' },
            { id: 'follow_up', label: 'Follow-up', icon: Heart, desc: 'Outpatient return schedules, suture removal & advice log', color: 'bg-blue-50 text-[#0077b6] dark:bg-blue-950/20 dark:text-sky-400' }
        ];

        return (
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50/50 to-sky-50/30 dark:from-slate-900/60 dark:to-slate-950 p-5 rounded-2xl border border-blue-100/50 dark:border-slate-800">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#0077b6]" /> Clinical Module Hub
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Select an orthopedic service card below to view, update, or dictation-transcribe clinical files for <b>{patient.demographics.name}</b>.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modules.map((m) => {
                        const IconComponent = m.icon;
                        return (
                            <button
                                key={m.id}
                                onClick={() => setActiveTab(m.id as any)}
                                className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-xs hover:border-[#0077b6]/30 hover:shadow-md transition-all active:scale-95 flex flex-col items-start gap-3.5 relative overflow-hidden group text-left cursor-pointer min-h-[140px]"
                            >
                                <div className={`p-2.5 rounded-lg ${m.color} transition-all group-hover:scale-110`}>
                                    <IconComponent className="h-5 w-5 stroke-[2]" />
                                </div>
                                <div>
                                    <h4 className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-white leading-tight group-hover:text-[#0077b6] transition-colors">
                                        {m.label}
                                    </h4>
                                    <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 mt-1 leading-normal">
                                        {m.desc}
                                    </p>
                                </div>
                                <ChevronRight className="h-4 w-4 absolute bottom-4 right-4 text-slate-300 group-hover:text-[#0077b6] group-hover:translate-x-1 transition-all" />
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderPAC = (patient: OrthoPatient) => {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => setActiveTab('hub')}
                        className="text-xs font-bold text-[#0077b6] hover:underline flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
                    >
                        ← Back to Patient Hub
                    </button>
                    <span className="text-[10px] bg-[#0077b6]/10 text-[#0077b6] px-2 py-0.5 rounded font-black uppercase tracking-wider font-mono">
                        PAC Module
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* PAC Form */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-[#0077b6]" /> Pre-Anesthetic Assessment
                        </h4>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Mallampati Airway Grade</label>
                                <div className="mt-1">
                                    <CustomSearchableDropdown
                                        value={patient.pacAirwayGrade || ''}
                                        onChange={(val) => updatePatient(patient.id, { pacAirwayGrade: val })}
                                        placeholder="Select airway grade..."
                                        options={[
                                            { value: "Class I", label: "Class I (Soft palate, fauces, uvula, pillars visible)" },
                                            { value: "Class II", label: "Class II (Soft palate, fauces, portion of uvula visible)" },
                                            { value: "Class III", label: "Class III (Soft palate, base of uvula visible)" },
                                            { value: "Class IV", label: "Class IV (Hard palate only visible)" }
                                        ]}
                                        searchable={false}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">NPO Status</label>
                                    <div className="mt-1">
                                        <CustomSearchableDropdown
                                            value={patient.pacNpoStatus || ''}
                                            onChange={(val) => updatePatient(patient.id, { pacNpoStatus: val })}
                                            placeholder="Select..."
                                            options={[
                                                { value: "NPO > 6 Hrs", label: "NPO > 6 Hrs" },
                                                { value: "NPO > 8 Hrs", label: "NPO > 8 Hrs" },
                                                { value: "Pending", label: "Pending" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">ASA Physical Status</label>
                                    <div className="mt-1">
                                        <CustomSearchableDropdown
                                            value={patient.pacAsaClass || ''}
                                            onChange={(val) => updatePatient(patient.id, { pacAsaClass: val })}
                                            placeholder="Select..."
                                            options={[
                                                { value: "ASA I", label: "ASA I (Normal healthy patient)" },
                                                { value: "ASA II", label: "ASA II (Mild systemic disease)" },
                                                { value: "ASA III", label: "ASA III (Severe systemic disease)" },
                                                { value: "ASA IV", label: "ASA IV (Severe disease with constant threat to life)" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">PAC Clearance</label>
                                    <div className="mt-1">
                                        <CustomSearchableDropdown
                                            value={patient.pacStatus || 'Pending'}
                                            onChange={(val) => updatePatient(patient.id, { pacStatus: val })}
                                            placeholder="Select..."
                                            options={[
                                                { value: "Pending", label: "Pending Clearance" },
                                                { value: "Cleared", label: "Cleared (Fit for SAB/GA)" },
                                                { value: "High Risk", label: "High Risk Cleared" },
                                                { value: "Deferred", label: "Deferred" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Clearance Date</label>
                                    <input
                                        type="date"
                                        value={patient.pacClearedDate || ''}
                                        onChange={(e) => updatePatient(patient.id, { pacClearedDate: e.target.value })}
                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pre-Op Checklist */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-purple-500" /> Pre-Operative Checklist Sync
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {PRE_OP_CHECKLIST.map(item => {
                                const isChecked = patient.preOpChecklist?.includes(item);
                                return (
                                    <button 
                                        type="button"
                                        key={item}
                                        onClick={() => {
                                            const current = patient.preOpChecklist || [];
                                            const next = isChecked 
                                                ? current.filter(i => i !== item)
                                                : [...current, item];
                                            updatePatient(patient.id, { preOpChecklist: next });
                                        }}
                                        className={`text-[10px] p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer
                                            ${isChecked 
                                                ? 'bg-purple-100/60 dark:bg-purple-950/20 border-purple-200 text-purple-800' 
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-200'
                                            }`}
                                    >
                                        {isChecked ? <CheckCircle className="h-3.5 w-3.5 text-purple-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                                        <span className="truncate">{item}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                Pre-Op Ready: {Math.round(((patient.preOpChecklist?.length || 0) / PRE_OP_CHECKLIST.length) * 100)}%
                            </span>
                            <div className="w-32 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-purple-500" 
                                    style={{ width: `${((patient.preOpChecklist?.length || 0) / PRE_OP_CHECKLIST.length) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderConsultation = (patient: OrthoPatient) => {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => setActiveTab('hub')}
                        className="text-xs font-bold text-[#0077b6] hover:underline flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
                    >
                        ← Back to Patient Hub
                    </button>
                    <span className="text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 px-2 py-0.5 rounded font-black uppercase tracking-wider font-mono">
                        Consultation Module
                    </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-4 w-4 text-amber-500" /> Multi-Disciplinary Consult Clearance Log
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Cardiology Clearance', stateKey: 'consultCardioClearance', color: 'border-rose-100 bg-rose-50/20' },
                            { label: 'Internal Medicine', stateKey: 'consultMedClearance', color: 'border-blue-100 bg-blue-50/20' },
                            { label: 'Pulmonology Clearance', stateKey: 'consultPulmoClearance', color: 'border-emerald-100 bg-emerald-50/20' }
                        ].map((c) => {
                            const val = (patient as any)[c.stateKey] || 'Pending';
                            return (
                                <div key={c.stateKey} className={`p-4 rounded-xl border ${c.color} space-y-2`}>
                                    <span className="text-[10px] font-black text-slate-500 uppercase block">{c.label}</span>
                                    <div className="flex gap-1.5">
                                        {['Pending', 'Cleared', 'High Risk'].map((st) => (
                                            <button
                                                type="button"
                                                key={st}
                                                onClick={() => updatePatient(patient.id, { [c.stateKey]: st })}
                                                className={`flex-1 py-1 px-2 text-[9px] font-bold rounded-md border text-center cursor-pointer transition-all
                                                    ${val === st 
                                                        ? 'bg-[#0077b6] text-white border-[#0077b6] shadow-xs' 
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                                    }`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Consultant Recommendation Notes</label>
                        <textarea
                            value={patient.consultNotes || ''}
                            onChange={(e) => updatePatient(patient.id, { consultNotes: e.target.value })}
                            placeholder="Type physician, cardiac, or respiratory recommendations (e.g., Hold aspirin 5 days pre-op, arrange 1 unit PRBC during surgery, post-op ICU bed)..."
                            className="w-full text-xs font-bold p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[120px] leading-relaxed"
                        />
                    </div>
                </div>
            </div>
        );
    };

    const renderOTPlan = (patient: OrthoPatient) => {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => setActiveTab('hub')}
                        className="text-xs font-bold text-[#0077b6] hover:underline flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
                    >
                        ← Back to Patient Hub
                    </button>
                    <span className="text-[10px] bg-[#0077b6]/10 text-[#0077b6] px-2 py-0.5 rounded font-black uppercase tracking-wider font-mono">
                        OT Plan Module
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <Scissors className="h-4 w-4 text-[#0077b6]" /> Surgical Technique & Implants
                        </h4>
                        
                        <div className="space-y-2">
                            <CustomSearchableDropdown
                                value={COMMON_PROCEDURES.includes(patient.surgicalProcedure || '') ? patient.surgicalProcedure : "Manual"}
                                onChange={(val) => {
                                    if (val !== "Manual") {
                                        updatePatient(patient.id, { surgicalProcedure: val });
                                    }
                                }}
                                placeholder="Planned surgery..."
                                options={[
                                    ...COMMON_PROCEDURES.map(p => ({ value: p, label: p })),
                                    { value: "Manual", label: "-- MANUAL PROCEDURE --" }
                                ]}
                            />
                            <textarea 
                                value={patient.surgicalProcedure || ''}
                                onChange={(e) => updatePatient(patient.id, { surgicalProcedure: e.target.value })}
                                placeholder="Describe procedure, approach, and implant planning..."
                                className="w-full text-xs font-medium p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[140px]"
                            />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#0077b6]" /> OT Theater Dispatch & Scheduling
                        </h4>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Surgical Timing</label>
                                <input
                                    type="datetime-local"
                                    value={patient.plannedSurgeryTime || ''}
                                    onChange={(e) => updatePatient(patient.id, { plannedSurgeryTime: e.target.value })}
                                    className="w-full mt-1 text-xs font-bold p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]"
                                />
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase block mb-1">Dispatch Readiness Check</label>
                                {[
                                    'Informed consent signed & verified',
                                    'Implants checked & sterile in theater',
                                    'Blood cross-matched & reserved',
                                    'Surgical site marked & prepped'
                                ].map((chk, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/50 dark:border-slate-800">
                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{chk}</span>
                                        <span className="text-xs text-emerald-500 font-extrabold font-mono uppercase">✔ READY</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderOperation = (patient: OrthoPatient) => {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => setActiveTab('hub')}
                        className="text-xs font-bold text-[#0077b6] hover:underline flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
                    >
                        ← Back to Patient Hub
                    </button>
                    <span className="text-[10px] bg-[#0077b6]/10 text-[#0077b6] px-2 py-0.5 rounded font-black uppercase tracking-wider font-mono">
                        Active Operation Module
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Op Details Form */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-[#0077b6]" /> Intra-Operative Surgical Log
                        </h4>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Primary Surgeon</label>
                                    <input
                                        type="text"
                                        value={patient.opSurgeon || ''}
                                        onChange={(e) => updatePatient(patient.id, { opSurgeon: e.target.value })}
                                        placeholder="Col. Dr. Nirab Kayastha"
                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Anesthesia Type Used</label>
                                    <div className="mt-1">
                                        <CustomSearchableDropdown
                                            value={patient.opAnesthesiaType || ''}
                                            onChange={(val) => updatePatient(patient.id, { opAnesthesiaType: val })}
                                            placeholder="Select anesthesia..."
                                            options={[
                                                { value: "SAB", label: "SAB (Spinal Anesthesia)" },
                                                { value: "GA", label: "GA (General Anesthesia)" },
                                                { value: "Block", label: "Fascia Iliaca / Femoral Block" },
                                                { value: "Local", label: "Local Infiltration" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Tourniquet Inflated</label>
                                    <input
                                        type="time"
                                        value={patient.opTourniquetTimeInflated || ''}
                                        onChange={(e) => updatePatient(patient.id, { opTourniquetTimeInflated: e.target.value })}
                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Tourniquet Deflated</label>
                                    <input
                                        type="time"
                                        value={patient.opTourniquetTimeDeflated || ''}
                                        onChange={(e) => updatePatient(patient.id, { opTourniquetTimeDeflated: e.target.value })}
                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Skin Closure Material</label>
                                    <div className="mt-1">
                                        <CustomSearchableDropdown
                                            value={patient.opSkinClosure || ''}
                                            onChange={(val) => updatePatient(patient.id, { opSkinClosure: val })}
                                            placeholder="Select closure..."
                                            options={[
                                                { value: "Staples", label: "Skin Staples" },
                                                { value: "Nylon 2-0", label: "Ethilon/Nylon 2-0" },
                                                { value: "Vicryl 3-0", label: "Vicryl 3-0 Subcuticular" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Implant Lot / Serial Codes</label>
                                    <input
                                        type="text"
                                        value={patient.opImplantLot || ''}
                                        onChange={(e) => updatePatient(patient.id, { opImplantLot: e.target.value })}
                                        placeholder="e.g. Depuy Synthes #LN84291-B"
                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Intra-Operative Summary</label>
                                <textarea
                                    value={patient.opIntraOpNotes || ''}
                                    onChange={(e) => updatePatient(patient.id, { opIntraOpNotes: e.target.value })}
                                    placeholder="Type surgical details (e.g., CRIF done under IITG control, proximal locking done with 2 screws, distal with 1 screw, distal pulses checked and intact post-op)..."
                                    className="w-full mt-1 text-xs font-semibold p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[90px]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Interactive Tourniquet Stopwatch Timer */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#0077b6] animate-pulse" /> Surgical Stopwatch & Tourniquet alert
                        </h4>
                        <div className="p-2 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/20">
                            <ProcedureTimer patient={patient} updatePatient={updatePatient} />
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/10 p-3 rounded-lg border border-red-100/40 text-[10px] text-red-700 dark:text-red-400 leading-normal">
                            ⚠️ <b>Safety Threshold Alert:</b> Orthopedic tourniquet inflation should not exceed <b>90 minutes</b> for upper limbs and <b>120 minutes</b> for lower limbs without deflation cycles to avoid ischemic neurovascular compromise.
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderPostOp = (patient: OrthoPatient) => {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => setActiveTab('hub')}
                        className="text-xs font-bold text-[#0077b6] hover:underline flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
                    >
                        ← Back to Patient Hub
                    </button>
                    <span className="text-[10px] bg-[#0077b6]/10 text-[#0077b6] px-2 py-0.5 rounded font-black uppercase tracking-wider font-mono">
                        Post-op Day Module
                    </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-[#0077b6]" /> Post-Operative Day Ward Checklist & Vitals
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Post-Op Day status</label>
                                    <input
                                        type="text"
                                        value={patient.postOpDay || ''}
                                        onChange={(e) => updatePatient(patient.id, { postOpDay: e.target.value })}
                                        placeholder="e.g. POD 1"
                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Local Dressing Check</label>
                                    <div className="mt-1">
                                        <CustomSearchableDropdown
                                            value={patient.postOpDressing || ''}
                                            onChange={(val) => updatePatient(patient.id, { postOpDressing: val })}
                                            placeholder="Select dressing check..."
                                            options={[
                                                { value: "Dry & Intact", label: "Dry & Intact" },
                                                { value: "Active Bleeding", label: "Active Bleeding / Soaking" },
                                                { value: "Redressed", label: "Redressed, clean" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Distal Neurovascular Status</label>
                                    <div className="mt-1">
                                        <CustomSearchableDropdown
                                            value={patient.postOpPulses || ''}
                                            onChange={(val) => updatePatient(patient.id, { postOpPulses: val })}
                                            placeholder="Select pulses..."
                                            options={[
                                                { value: "Intact DP & PT pulses", label: "Intact DP & PT pulses (Warm, pink, cap-refill < 2s)" },
                                                { value: "DP absent, PT intact", label: "DP absent, PT intact" },
                                                { value: "Cold / Pulseless - ALERT", label: "Cold / Pulseless - ALERT RESIDENT" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Post-Op Hb (g/dL)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={patient.postOpHb || ''}
                                        onChange={(e) => updatePatient(patient.id, { postOpHb: e.target.value })}
                                        placeholder="10.2"
                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Post-Op Analgesia / Pain Plan</label>
                                <textarea
                                    value={patient.postOpAnalgesia || ''}
                                    onChange={(e) => updatePatient(patient.id, { postOpAnalgesia: e.target.value })}
                                    placeholder="Type post-op analgesia (e.g. Inj. Tramadol 100mg IV TDS, round-the-clock paracetamol 1g QDS)..."
                                    className="w-full mt-1 text-xs font-semibold p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[110px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderFollowUp = (patient: OrthoPatient) => {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => setActiveTab('hub')}
                        className="text-xs font-bold text-[#0077b6] hover:underline flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
                    >
                        ← Back to Patient Hub
                    </button>
                    <span className="text-[10px] bg-[#0077b6]/10 text-[#0077b6] px-2 py-0.5 rounded font-black uppercase tracking-wider font-mono">
                        Follow-up Module
                    </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Heart className="h-4 w-4 text-[#0077b6]" /> Outpatient Clinic Return & Advice Plan
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Return Schedule</label>
                                    <div className="mt-1">
                                        <CustomSearchableDropdown
                                            value={patient.followUpPeriod || ''}
                                            onChange={(val) => updatePatient(patient.id, { followUpPeriod: val })}
                                            placeholder="Select period..."
                                            options={[
                                                { value: "2 Weeks", label: "2 Weeks (Suture removal)" },
                                                { value: "6 Weeks", label: "6 Weeks (Check X-ray, partial wt-bearing)" },
                                                { value: "3 Months", label: "3 Months (Full weight bearing check)" },
                                                { value: "6 Months", label: "6 Months" }
                                            ]}
                                            searchable={false}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Suture/Staples Removal Date</label>
                                    <input
                                        type="date"
                                        value={patient.followUpSutureRemoval || ''}
                                        onChange={(e) => updatePatient(patient.id, { followUpSutureRemoval: e.target.value })}
                                        className="w-full mt-1 text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Mobilization & Weight Bearing Status</label>
                                <div className="mt-1">
                                    <CustomSearchableDropdown
                                        value={patient.followUpWeightBearing || ''}
                                        onChange={(val) => updatePatient(patient.id, { followUpWeightBearing: val })}
                                        placeholder="Select status..."
                                        options={[
                                            { value: "Non Weight Bearing", label: "Strictly Non-Weight Bearing (NWB)" },
                                            { value: "Touch Toe Weight Bearing", label: "Touch-toe / Toe-touch Weight Bearing" },
                                            { value: "Partial Weight Bearing", label: "Partial Weight Bearing (PWB)" },
                                            { value: "Full Weight Bearing", label: "Full Weight Bearing as tolerated (FWB)" }
                                        ]}
                                        searchable={false}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase">Special Follow-up advice</label>
                                <textarea
                                    value={patient.followUpAdvice || ''}
                                    onChange={(e) => updatePatient(patient.id, { followUpAdvice: e.target.value })}
                                    placeholder="Type specific instructions (e.g., Active knee mobilization up to 90 degrees, avoid squatting/cross-legged sitting, return immediately if dressing soakage or severe calf pain)..."
                                    className="w-full mt-1 text-xs font-semibold p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6] min-h-[110px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] md:h-[calc(100vh-140px)] print:h-auto print:overflow-visible print:border-none print:shadow-none bg-[#f8fafc] dark:bg-slate-950 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden mx-4 md:mx-0 mt-4 md:mt-0 font-sans">
            
            {/* 1. Laxmi Bank Style Dashboard Header */}
            <div className="bg-white dark:bg-slate-900 px-4 md:px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0077b6] flex items-center justify-center text-white shadow-sm border border-[#0077b6]/20">
                        <Activity className="h-5 w-5 text-white stroke-[2.5]" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-800 dark:text-slate-200 dark:text-white tracking-tight flex items-center gap-2">
                            G-MED Mini EMR
                            <span className="text-[9px] bg-sky-50 dark:bg-sky-950/40 text-[#0077b6] dark:text-sky-400 font-extrabold uppercase px-2 py-0.5 rounded border border-sky-200/55 dark:border-sky-800/40 tracking-wider font-mono flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                                Ward Live
                            </span>
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-0.5 font-mono">
                            High-Volume Orthopedic Residency Suite
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 max-md:w-full max-md:justify-between flex-wrap">
                    {/* Return to Dashboard Button if not in dashboard */}
                    {viewMode !== 'dashboard' && (
                        <button
                            onClick={() => {
                                setViewMode('dashboard');
                                setActiveFilter(null);
                                setSelectedPatientId(null);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer transition-all border border-slate-200 dark:border-slate-700 shadow-xs"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            <span>← Dashboard</span>
                        </button>
                    )}

                    {/* Search Patient Box */}
                    <div className="relative max-md:flex-1 max-w-xs min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search patients..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                if (viewMode === 'dashboard') {
                                    setViewMode('list');
                                    setActiveFilter(null);
                                    setSelectedPatientId(null);
                                }
                            }}
                            className="w-full text-xs font-bold pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6] text-slate-800 dark:text-slate-200 dark:text-slate-100 placeholder:text-slate-400"
                        />
                    </div>

                    {/* Notification bell dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setNotificationsOpen(!notificationsOpen)}
                            className="p-2.5 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 rounded-xl text-slate-600 dark:text-slate-300 relative cursor-pointer border border-slate-200/50 dark:border-slate-700/50"
                        >
                            <Bell className="h-4 w-4" />
                            {notifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center animate-bounce">
                                    {notifications.length}
                                </span>
                            )}
                        </button>
                        {notificationsOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)}></div>
                                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden p-2">
                                    <div className="p-2 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Clinical Alerts</span>
                                        <button onClick={() => setNotifications([])} className="text-[9px] text-[#0077b6] font-bold hover:underline">Clear All</button>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-60 overflow-y-auto">
                                        {notifications.length > 0 ? (
                                            notifications.map((notif, i) => (
                                                <div key={i} className="p-2.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 flex items-start gap-2 leading-normal">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                                    <span>{notif}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-slate-400 italic text-[10px]">No active clinical alerts.</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Main EMR Workspace Area */}
            <div className="flex flex-1 overflow-hidden min-h-0 relative">
                {/* Sidebar Panel: Show only during 'list' mode, hide if patient selected on mobile */}
                <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/55 dark:bg-slate-900/40 flex flex-col print:hidden shrink-0 ${viewMode === 'list' ? (selectedPatientId ? 'hidden md:flex' : 'flex') : 'hidden'}`}>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div className="flex gap-2 mb-3">
                            <button 
                                onClick={handleAddPatientClick}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-[#0077b6] hover:bg-[#005f92] text-white rounded-lg transition-all font-semibold text-xs uppercase tracking-wide cursor-pointer shadow-sm border border-[#0077b6]/10"
                            >
                                <Plus className="h-4 w-4 stroke-[2]" /> Add Bed Patient
                            </button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Filter by name, bed, SBH..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/85 rounded-lg text-xs font-medium focus:ring-1 focus:ring-[#0077b6] focus:border-[#0077b6] focus:outline-none dark:text-white transition-all placeholder-slate-400"
                            />
                        </div>
                    </div>
                    
                    {/* Patient List Cards */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                        {filteredPatients.length > 0 ? (
                            filteredPatients.map(patient => {
                                const initials = patient.demographics.name.split(' ').map(nByVal => nByVal[0]).join('').substring(0, 2).toUpperCase();
                                return (
                                    <div 
                                        key={patient.id}
                                        onClick={() => setSelectedPatientId(patient.id)}
                                        className={`p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-all duration-200 flex gap-3 items-start border-l-4
                                            ${selectedPatientId === patient.id 
                                                ? 'bg-blue-50/40 dark:bg-[#0077b6]/10 border-l-[#0077b6] shadow-sm' 
                                                : 'border-l-transparent text-slate-700 dark:text-slate-300'}`}
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-slate-200/65 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-[#0077b6] shrink-0 uppercase shadow-xs">
                                            {initials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <span className="text-[9px] font-bold text-[#0077b6] bg-[#0077b6]/8 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                                                    Bed {patient.demographics.bedNumber}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    {patient.dangerSigns && patient.dangerSigns.length > 0 && (
                                                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-bounce" />
                                                    )}
                                                    {patient.quickNotes && patient.quickNotes.trim().length > 0 && (
                                                        <FileText className={`h-3.5 w-3.5 filter drop-shadow-[0_0_2px_rgba(245,158,11,0.2)] ${
                                                            patient.quickNotesCategory === 'Urgent'
                                                                ? 'text-rose-500 animate-pulse'
                                                                : patient.quickNotesCategory === 'Routine'
                                                                ? 'text-amber-500'
                                                                : 'text-sky-500'
                                                        }`} title={`Active Temporary Quick Notes (${patient.quickNotesCategory || 'General'})`} />
                                                    )}
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">#{patient.demographics.sbhNumber}</span>
                                                </div>
                                            </div>
                                            <h3 className="font-extrabold text-slate-900 dark:text-white mt-1 text-xs sm:text-sm tracking-tight truncate">
                                                {patient.demographics.name}
                                            </h3>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 italic leading-snug">
                                                {patient.diagnosis}
                                            </p>
                                            
                                            <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-dashed border-slate-200/50 dark:border-slate-800/40">
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide
                                                    ${patient.status.toLowerCase().includes('pre-op') 
                                                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100/30' 
                                                        : patient.status.toLowerCase().includes('post-op') 
                                                            ? 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400 border border-green-100/30' 
                                                            : 'bg-slate-100 text-slate-605 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/40'}`}>
                                                    {patient.status}
                                                </span>
                                                
                                                {/* Checklist summary */}
                                                <span className="text-[9px] text-slate-400/85 dark:text-slate-550 font-bold uppercase font-mono tracking-wider shrink-0">
                                                    {patient.status.toLowerCase().includes('pre-op') 
                                                        ? `Pre-op: ${patient.preOpChecklist?.length || 0}/6` 
                                                        : `Admit: ${patient.admissionChecklist?.length || 0}/5`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-[11px] text-slate-400 italic text-center py-8">No patients match filter.</p>
                        )}
                    </div>
                </div>

                {/* Main Active Panel: Dashboard / Ward Summary / Ward Duties / Selected Patient Record */}
                <div className={`flex-1 flex flex-col min-w-0 print:block print:w-full print:h-auto print:overflow-visible bg-white dark:bg-slate-950/25 ${(viewMode === 'list' || viewMode === 'dashboard') && !selectedPatientId ? 'flex' : 'flex'}`}>
                    {viewMode === 'dashboard' ? (
                        renderDashboard()
                    ) : viewMode === 'ward-summary' ? (
                        renderWardSummary()
                    ) : viewMode === 'ward-duties' ? (
                        renderWardDuties()
                    ) : viewMode === 'ot-list' ? (
                        renderOTList()
                    ) : selectedPatient ? (
                        <>
                            {/* Selected Patient Premium Clinical Header Banner */}
                            <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/80 print:hidden shrink-0">
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        {/* Back arrow on mobile to show list */}
                                        <button 
                                            onClick={() => setSelectedPatientId(null)}
                                            className="md:hidden flex shrink-0 items-center justify-center w-9 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-500 hover:text-slate-700 shadow-sm cursor-pointer"
                                            title="Return to Directory"
                                        >
                                            <ChevronUp className="h-5 w-5 -rotate-90 text-slate-500" />
                                        </button>

                                        {/* Initial Avatar circle */}
                                        <div className="hidden sm:flex w-12 h-12 rounded-lg bg-[#0077b6] items-center justify-center font-bold text-white text-base shrink-0 border border-blue-400/10 shadow-sm">
                                            {selectedPatient.demographics.name.split(' ').map(nByVal => nByVal[0]).join('').substring(0, 2).toUpperCase()}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate leading-none">
                                                    {selectedPatient.demographics.name}
                                                </h1>
                                                <span className="text-[10px] font-black px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-mono">
                                                    {selectedPatient.demographics.age}Y · {selectedPatient.demographics.sex.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                <span className="flex items-center gap-1 px-2.5 py-1 bg-sky-50 dark:bg-sky-950/20 text-[#0077b6] dark:text-sky-400 rounded-lg border border-sky-100 dark:border-sky-900/30">
                                                    <Activity className="h-3.5 w-3.5 shrink-0" />
                                                    <span>Bed {selectedPatient.demographics.bedNumber || 'N/A'}</span>
                                                </span>
                                                <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800">
                                                    <CreditCard className="h-3.5 w-3.5 shrink-0" />
                                                    <span>Ref: {selectedPatient.demographics.sbhNumber || 'No ID'}</span>
                                                </span>
                                                <button 
                                                    onClick={() => window.location.href = `tel:${selectedPatient.demographics.mobile}`}
                                                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:text-[#0077b6] dark:hover:text-sky-400 transition-colors cursor-pointer"
                                                    title="Call Patient Contact"
                                                >
                                                    <Phone className="h-3.5 w-3.5 shrink-0" />
                                                    <span>{selectedPatient.demographics.mobile || 'No Phone'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions & Utilities Dropdown */}
                                    <div className="flex items-center gap-2.5 shrink-0 self-end xl:self-auto">
                                        {/* Auto-save / Manual save HUD indicator */}
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    localStorage.setItem('gmed_patients', JSON.stringify(patients));
                                                    setEmrSaveStatus('saving');
                                                    setTimeout(() => {
                                                        setEmrSaveStatus('saved');
                                                        const now = new Date();
                                                        setEmrLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
                                                        setTimeout(() => setEmrSaveStatus('idle'), 2000);
                                                    }, 500);
                                                }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all border shadow-xs cursor-pointer ${
                                                    emrSaveStatus === 'saved' 
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-200' 
                                                        : emrSaveStatus === 'saving'
                                                        ? 'bg-blue-50 dark:bg-blue-950/20 text-[#0077b6] border-blue-200 shadow-inner'
                                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                }`}
                                                title="Manually save all EMR records"
                                            >
                                                {emrSaveStatus === 'saving' ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0077b6]" />
                                                ) : emrSaveStatus === 'saved' ? (
                                                    <Check className="h-3.5 w-3.5 text-emerald-500 animate-bounce" />
                                                ) : (
                                                    <Save className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                                )}
                                                <span className="hidden sm:inline">
                                                    {emrSaveStatus === 'saving' ? 'Saving...' : emrSaveStatus === 'saved' ? 'Saved' : 'Save'}
                                                </span>
                                            </button>

                                            {emrLastSavedTime && (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium font-mono shrink-0 hidden md:inline">
                                                    Saved: {emrLastSavedTime}
                                                </span>
                                            )}
                                        </div>

                                        <div className="relative">
                                            <button 
                                                onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer"
                                            >
                                                <Zap className="h-3.5 w-3.5 text-amber-500" />
                                                Quick Actions
                                                <ChevronDown className="h-3.5 w-3.5 opacity-55" />
                                            </button>
                                            
                                            {quickActionsOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setQuickActionsOpen(false)}></div>
                                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                                                        <button 
                                                            onClick={() => {
                                                                updatePatient(selectedPatient.id, { status: "Ready for Discharge" });
                                                                setQuickActionsOpen(false);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                        >
                                                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                                                            Mark Ready for Discharge
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                alert("Attending alerted successfully!");
                                                                setQuickActionsOpen(false);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                        >
                                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                            Alert Attending
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <button 
                                            onClick={() => handleDeletePatient(selectedPatient.id)}
                                            className="p-2 bg-white dark:bg-slate-800/65 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-100 dark:hover:border-red-900 transition-all shadow-sm cursor-pointer"
                                            title="Delete Active Record"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Apple-style Segmented Navigation Tabs */}
                                {activeTab !== 'hub' ? (
                                    <div className="flex items-center gap-2 mt-3 print:hidden">
                                        <button
                                            onClick={() => setActiveTab('hub')}
                                            className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 hover:text-[#0077b6] flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/60 cursor-pointer"
                                        >
                                            ← Hub Dashboard
                                        </button>
                                        <span className="text-slate-300 text-xs font-bold">/</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[#0077b6] bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1 rounded-md border border-blue-100/40 dark:border-blue-900/30">
                                            {activeTab === 'summary' ? 'Diagnosis & Comorbidities' : activeTab.replace('_', ' ')}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="text-[10px] font-bold text-slate-400 mt-3 flex items-center gap-1 uppercase tracking-widest font-mono">
                                        🏥 G-MED Ortho Clinic Hub
                                    </div>
                                )}
                            </div>

                            {/* 3. Shorthand Dictation AI Bar */}
                            <div className="p-4 bg-blue-50/70 dark:bg-blue-900/10 border-b border-blue-100/60 dark:border-blue-950/20 flex flex-col md:flex-row md:items-center gap-4 print:hidden shrink-0">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-[#0077b6] uppercase tracking-widest mb-1.5 block flex items-center gap-1.5 font-mono">
                                        <Sparkles className="h-3.5 w-3.5 text-blue-500 animate-pulse" /> AI Smart Entry (Shorthand Dictation / Expanding Notes)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={shorthandInput}
                                            onChange={(e) => setShorthandInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleShorthandSubmit()}
                                            placeholder={speechSupported ? "🎤 Speak (hands-free dictation) or type messy shorthand orthopedic notes..." : "Type shorthand notes (e.g. #femur post op day 2, distal pulse +, plan check Hb tomorrow)..."}
                                            className="w-full bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-800/80 rounded-xl pl-4 pr-24 py-3 text-xs md:text-sm focus:ring-1 focus:ring-[#0077b6] focus:border-[#0077b6] outline-none dark:text-white shadow-sm"
                                        />
                                        {speechError && (
                                            <div className="absolute left-0 -bottom-6 text-[10px] text-red-600 dark:text-red-400 font-extrabold bg-white dark:bg-slate-900 px-2 py-1 rounded border border-red-200 dark:border-red-900/50 shadow-md z-30 flex items-center gap-1 animate-pulse">
                                                <AlertTriangle className="h-3 w-3 text-red-550" />
                                                <span>{speechError}</span>
                                            </div>
                                        )}
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {speechSupported && (
                                                <button
                                                    type="button"
                                                    onClick={toggleListening}
                                                    className={`p-1.5 rounded-lg transition-all focus:outline-none flex items-center justify-center relative ${isListening ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                                    title={isListening ? "Stop hands-free dictation" : "Start hands-free dictation"}
                                                >
                                                    {isListening ? (
                                                        <>
                                                            <Mic className="h-4 w-4 animate-bounce" />
                                                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <Mic className="h-4 w-4" />
                                                    )}
                                                </button>
                                            )}
                                            <button
                                                onClick={handleShorthandSubmit}
                                                disabled={!shorthandInput.trim() || isProcessing}
                                                className={`p-1.5 rounded-lg text-white transition-all cursor-pointer
                                                    ${!shorthandInput.trim() || isProcessing ? 'bg-slate-300 dark:bg-slate-800 shadow-sm' : 'bg-[#0077b6] hover:opacity-95'}`}
                                            >
                                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin text-[#0077b6]" /> : <Send className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div> 

                            {/* 4. Active Tab Interactive Canvas Section */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 dark:bg-slate-950/20 print:overflow-visible print:p-0 print:block print:bg-white relative">
                                {activeTab === 'summary' && renderSummary(selectedPatient)}
                                {activeTab === 'demographics' && renderDemographics(selectedPatient)}
                                {activeTab === 'history_exam' && renderHistoryExam(selectedPatient)}
                                {activeTab === 'investigations' && renderInvestigations(selectedPatient)}
                                {activeTab === 'plan' && renderPlan(selectedPatient)}
                                {activeTab === 'daily_progress' && renderDailyProgress(selectedPatient)}
                                {activeTab === 'discharge' && renderDischargeSummary(selectedPatient)}

                                {activeTab === 'hub' && renderPatientHub(selectedPatient)}
                                {activeTab === 'diagnosis' && (
                                    <div className="space-y-6">
                                        <button 
                                            onClick={() => setActiveTab('hub')}
                                            className="text-xs font-bold text-[#0077b6] hover:underline flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer mb-2"
                                        >
                                            ← Back to Patient Hub
                                        </button>
                                        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <Activity className="h-4 w-4 text-emerald-500" /> Primary Orthopedic Diagnosis & Comorbidities
                                            </h4>
                                            {renderSummary(selectedPatient)}
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'pac' && renderPAC(selectedPatient)}
                                {activeTab === 'consultation' && renderConsultation(selectedPatient)}
                                {activeTab === 'ot_plan' && renderOTPlan(selectedPatient)}
                                {activeTab === 'operation' && renderOperation(selectedPatient)}
                                {activeTab === 'post_op' && renderPostOp(selectedPatient)}
                                {activeTab === 'follow_up' && renderFollowUp(selectedPatient)}

                                {/* Quick-Access Floating Action Menu and Drawer Overlay */}
                                {renderQuickAccessMenu(selectedPatient)}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 bg-slate-50 dark:bg-slate-950/10">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 mb-4 shadow-sm">
                                <Users className="h-8 w-8 opacity-40 shrink-0" />
                            </div>
                            <h2 className="text-base font-bold text-slate-700 dark:text-slate-300">No Patient File Open</h2>
                            <p className="text-xs mt-1.5 text-center text-slate-500 max-w-xs leading-relaxed">
                                Please search and open a clinical file in G-MED Ward list or add a patient record to begin charting.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Ward Update Modal Popup */}
            {isWardUpdateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-[#0077b6] text-white">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5" />
                                <h3 className="text-sm font-black uppercase tracking-wider">Broadcast Ward Update</h3>
                            </div>
                            <button 
                                onClick={() => setIsWardUpdateModalOpen(false)}
                                className="text-white/80 hover:text-white font-extrabold text-sm"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-slate-500 leading-normal">
                                Post a broadcast alert to Unit-I Orthopedics team and the resident duty room. Shorthand notes will automatically format into a team alert.
                            </p>
                            <textarea
                                value={wardUpdateText}
                                onChange={(e) => setWardUpdateText(e.target.value)}
                                placeholder="e.g. Bed 12 Hb 8.1 post-op, Sabina Rana accepted for tomorrow saber Sab SAB, Yadav Puri scheduled GA STSG..."
                                rows={4}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs md:text-sm text-slate-800 dark:text-slate-200 dark:text-white focus:ring-1 focus:ring-[#0077b6] outline-none"
                            />
                            <div className="flex justify-end gap-2.5">
                                <button
                                    onClick={() => setIsWardUpdateModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (wardUpdateText.trim()) {
                                            setNotifications([
                                                `Unit Update: ${wardUpdateText}`,
                                                ...notifications
                                            ]);
                                            setWardUpdateText('');
                                            setIsWardUpdateModalOpen(false);
                                        }
                                    }}
                                    className="px-4 py-2 bg-[#0077b6] hover:bg-[#005f92] text-white font-bold text-xs rounded-xl cursor-pointer"
                                >
                                    Post Update
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
