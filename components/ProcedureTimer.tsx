import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Play, Pause, RotateCcw, Plus, Trash2, Clock, CheckCircle, Timer, ClipboardList, AlertTriangle, Calendar, Hourglass, Trash, Search, ChevronDown } from 'lucide-react';
import { OrthoPatient, DailyProgressNote } from '../types';
import { COMMON_PROCEDURES } from '../constants';

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
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
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
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearchQuery('');
                }}
                className="w-full flex items-center justify-between text-xs font-bold px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-[#0077b6]/30 focus:border-[#0077b6] text-left transition-all cursor-pointer"
            >
                <span className={value ? 'text-slate-800 dark:text-slate-150 truncate pr-2' : 'text-slate-400 dark:text-slate-500 font-medium truncate pr-2'}>
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

const getTrendMessage = (sortedData: { durationSeconds: number }[]) => {
    if (sortedData.length < 2) return null;
    const first = sortedData[0].durationSeconds;
    const last = sortedData[sortedData.length - 1].durationSeconds;
    
    // Simple slope using linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = sortedData.length;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += sortedData[i].durationSeconds;
        sumXY += i * sortedData[i].durationSeconds;
        sumXX += i * i;
    }
    const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) : 0;
    const diff = last - first;
    const pct = first > 0 ? (Math.abs(diff) / first) * 100 : 0;

    if (slope < -1) {
        return {
            status: 'improving',
            text: `Efficiency: Improving (declined by ${pct.toFixed(0)}%)`,
            desc: 'Surgical durations are decreasing safely over successive runs.',
            color: 'text-emerald-700 bg-emerald-50/55 dark:text-emerald-400 dark:bg-emerald-950/20 border-emerald-250/50 dark:border-emerald-900/30'
        };
    } else if (slope > 1) {
        return {
            status: 'climbing',
            text: `Duration: Increasing (+${pct.toFixed(0)}%)`,
            desc: 'Procedural times are lengthening. Monitor for case complexities.',
            color: 'text-amber-700 bg-amber-50/55 dark:text-amber-400 dark:bg-amber-950/20 border-amber-250/50 dark:border-amber-900/30'
        };
    } else {
        return {
            status: 'stable',
            text: 'Efficiency: Consistent / Stabilized',
            desc: 'Procedural speed has stabilized with minimal deviation.',
            color: 'text-blue-700 bg-blue-50/55 dark:text-blue-400 dark:bg-blue-950/20 border-blue-250/50 dark:border-blue-900/30'
        };
    }
};

interface DurationTrendChartProps {
    logs: { id: string; date: string; procedureName: string; durationSeconds: number; notes?: string }[];
}

function DurationTrendChart({ logs }: DurationTrendChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 150 });
    const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

    // Dynamic Sizing Observer
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const { width } = entries[0].contentRect;
            setDimensions((prev) => ({ ...prev, width }));
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const sortedData = useMemo(() => {
        return logs.map(log => {
            let timestamp = Date.now();
            if (log.id.startsWith('p_duration_')) {
                const tsPart = parseInt(log.id.replace('p_duration_', ''), 10);
                if (!isNaN(tsPart)) {
                    timestamp = tsPart;
                }
            }
            return {
                ...log,
                timestamp,
                dateObj: new Date(timestamp)
            };
        }).sort((a, b) => a.timestamp - b.timestamp);
    }, [logs]);

    const trend = useMemo(() => getTrendMessage(sortedData), [sortedData]);

    useEffect(() => {
        if (!svgRef.current || dimensions.width === 0 || sortedData.length < 2) return;

        const margin = { top: 12, right: 12, bottom: 22, left: 35 };
        const width = dimensions.width - margin.left - margin.right;
        const height = dimensions.height - margin.top - margin.bottom;

        // Clear existing children
        const svgElement = d3.select(svgRef.current);
        svgElement.selectAll('*').remove();

        const svg = svgElement
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(sortedData, d => d.dateObj) as [Date, Date])
            .range([0, width]);

        const maxDuration = d3.max(sortedData, d => d.durationSeconds) || 0;
        const yScale = d3.scaleLinear()
            .domain([0, maxDuration * 1.15])
            .range([height, 0]);

        const yTicks = 3;

        // Grid lines (horizontal)
        svg.append('g')
            .attr('class', 'grid text-slate-100 dark:text-slate-800/80 opacity-60')
            .call(d3.axisLeft(yScale)
                .ticks(yTicks)
                .tickSize(-width)
                .tickFormat(() => '')
            )
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll("line").attr("stroke", "currentColor"));

        // X Axis
        const xTicks = Math.min(sortedData.length, dimensions.width > 280 ? 4 : 2);
        const xAxis = svg.append('g')
            .attr('transform', `translate(0, ${height})`)
            .attr('class', 'text-[8px] font-mono text-slate-450 dark:text-slate-500');

        xAxis.call(d3.axisBottom(xScale)
            .ticks(xTicks)
            .tickFormat(d3.timeFormat('%m/%d') as any)
        );
        xAxis.select(".domain")
            .attr("stroke", "currentColor")
            .attr("class", "text-slate-200 dark:text-slate-800");
        xAxis.selectAll(".tick line")
            .attr("stroke", "currentColor")
            .attr("class", "text-slate-100 dark:text-slate-800");

        // Y Axis
        svg.append('g')
            .attr('class', 'text-[8px] font-mono text-slate-450 dark:text-slate-500')
            .call(d3.axisLeft(yScale)
                .ticks(yTicks)
                .tickFormat((d) => {
                    const totalSecs = d as number;
                    if (totalSecs >= 60) {
                        return `${Math.round(totalSecs / 60)}m`;
                    }
                    return `${totalSecs}s`;
                })
            )
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick line").remove());

        // Area Gradient Definition
        const gradientId = `trend-gradient-${Date.now()}`;
        const defs = svgElement.append('defs');
        const linearGradient = defs.append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');

        linearGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#0077b6')
            .attr('stop-opacity', '0.22');
        linearGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#0077b6')
            .attr('stop-opacity', '0.01');

        // Draw Area
        const areaGenerator = d3.area<any>()
            .x(d => xScale(d.dateObj))
            .y0(height)
            .y1(d => yScale(d.durationSeconds))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(sortedData)
            .attr('fill', `url(#${gradientId})`)
            .attr('d', areaGenerator);

        // Draw Line
        const lineGenerator = d3.line<any>()
            .x(d => xScale(d.dateObj))
            .y(d => yScale(d.durationSeconds))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(sortedData)
            .attr('fill', 'none')
            .attr('stroke', '#0077b6')
            .attr('stroke-width', 2)
            .attr('d', lineGenerator);

        // Highlight Dots with custom hover actions
        const points = svg.append('g').attr('class', 'points-group');
        
        points.selectAll('.circle-point')
            .data(sortedData)
            .enter()
            .append('circle')
            .attr('cx', d => xScale(d.dateObj))
            .attr('cy', d => yScale(d.durationSeconds))
            .attr('r', 4)
            .attr('class', 'fill-white dark:fill-slate-900 stroke-[#0077b6] cursor-pointer')
            .attr('stroke-width', 2)
            .on('mouseenter', (event, d) => {
                const cx = xScale(d.dateObj) + margin.left;
                const cy = yScale(d.durationSeconds) + margin.top;
                
                d3.select(event.currentTarget)
                    .transition()
                    .duration(120)
                    .attr('r', 6)
                    .attr('stroke-width', 3)
                    .attr('fill', '#0077b6')
                    .attr('stroke', '#ffffff');

                setHoveredPoint({ ...d, cx, cy });
            })
            .on('mouseleave', (event) => {
                d3.select(event.currentTarget)
                    .transition()
                    .duration(120)
                    .attr('r', 4)
                    .attr('stroke-width', 2)
                    .attr('fill', '#ffffff')
                    .attr('stroke', '#0077b6');

                setHoveredPoint(null);
            });

    }, [dimensions.width, dimensions.height, sortedData]);

    if (logs.length < 2) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-xl text-center flex flex-col items-center justify-center min-h-[140px] shadow-sm select-none">
                <Clock className="h-7 w-7 text-slate-300 dark:text-slate-650 mb-1.5 stroke-1" />
                <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Statistical Trend Analytics</h5>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 max-w-[210px] mt-0.5 leading-normal">
                    Please log at least 2 procedures to generate real-time D3 speed & efficiency trend lines.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col space-y-3 relative">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Timer className="h-4 w-4 text-[#0077b6]" />
                    <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-450 tracking-wider font-sans">Speed & Efficiency Trend</span>
                </div>
                <span className="text-[9px] font-mono font-bold text-slate-400">Chronological</span>
            </div>

            {/* D3 Graphic Shell */}
            <div ref={containerRef} className="w-full relative h-[150px] flex items-center justify-center">
                <svg ref={svgRef} className="w-full h-full overflow-visible" />
                
                {/* Clean React interactive overlay tooltip */}
                {hoveredPoint && (
                    <div 
                        className="absolute z-20 pointer-events-none bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 p-2.5 rounded-xl shadow-xl text-left text-[11px] max-w-[190px]"
                        style={{ 
                            left: `${Math.min(hoveredPoint.cx + 10, dimensions.width - 200)}px`, 
                            top: `${Math.max(hoveredPoint.cy - 50, 10)}px`,
                        }}
                    >
                        <p className="font-extrabold text-slate-900 dark:text-white truncate">{hoveredPoint.procedureName}</p>
                        <p className="text-[9px] text-slate-400 font-semibold">{hoveredPoint.date}</p>
                        <div className="flex items-center gap-1 mt-1 font-mono font-black text-[#0077b6] dark:text-blue-400">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>
                                {(() => {
                                    const totalSecs = hoveredPoint.durationSeconds;
                                    const hrs = Math.floor(totalSecs / 3600);
                                    const mins = Math.floor((totalSecs % 3600) / 60);
                                    const secs = totalSecs % 60;
                                    const parts = [];
                                    if (hrs > 0) parts.push(`${hrs}h`);
                                    if (mins > 0) parts.push(`${mins}m`);
                                    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
                                    return parts.join(' ');
                                })()}
                            </span>
                        </div>
                        {hoveredPoint.notes && (
                            <p className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-900 text-[9px] text-slate-500 italic max-h-[44px] overflow-hidden text-ellipsis line-clamp-2 leading-relaxed">
                                "{hoveredPoint.notes}"
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Analysis Box */}
            {trend && (
                <div className={`p-2.5 rounded-xl border text-[10px] space-y-0.5 leading-snug flex flex-col justify-center ${trend.color}`}>
                    <div className="font-extrabold uppercase tracking-wider flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${trend.status === 'improving' ? 'bg-emerald-500 animate-pulse' : trend.status === 'stable' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                        {trend.text}
                    </div>
                    <div className="font-medium text-slate-500 dark:text-slate-350">{trend.desc}</div>
                </div>
            )}
        </div>
    );
}

interface ProcedureTimerProps {
    patient: OrthoPatient;
    updatePatient: (patientId: string, updates: Partial<OrthoPatient>) => void;
}

export default function ProcedureTimer({ patient, updatePatient }: ProcedureTimerProps) {
    const [time, setTime] = useState(0); // in seconds
    const [isRunning, setIsRunning] = useState(false);
    const [selectedProcType, setSelectedProcType] = useState('Manual');
    const [manualProcName, setManualProcName] = useState('');
    const [clinicalNotes, setClinicalNotes] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Countdown specific states
    const [activeSubTab, setActiveSubTab] = useState<'stopwatch' | 'countdown'>('stopwatch');
    const [plannedTimeInput, setPlannedTimeInput] = useState('');
    const [now, setNow] = useState(new Date());

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Stop timer on patient change, synching states
    useEffect(() => {
        setIsRunning(false);
        setTime(0);
        setClinicalNotes('');
        setError('');
        setSuccessMessage('');
        
        // Load existing scheduled surgery time if available
        if (patient.plannedSurgeryTime) {
            setPlannedTimeInput(patient.plannedSurgeryTime);
        } else {
            setPlannedTimeInput('');
        }

        // Initialize procedure type with surgical procedure if planned
        if (patient.surgicalProcedure) {
            const trimmed = patient.surgicalProcedure.trim();
            if (COMMON_PROCEDURES.includes(trimmed)) {
                setSelectedProcType(trimmed);
                setManualProcName('');
            } else {
                setSelectedProcType('Manual');
                setManualProcName(trimmed);
            }
        } else {
            setSelectedProcType('Manual');
            setManualProcName('');
        }
    }, [patient.id, patient.plannedSurgeryTime]);

    // Auto-save: Load and synchronize logs from localStorage database on patient change
    useEffect(() => {
        try {
            const savedStr = localStorage.getItem(`gmed_proc_logs_${patient.id}`);
            if (savedStr) {
                const savedLogs = JSON.parse(savedStr);
                if (Array.isArray(savedLogs) && savedLogs.length > 0) {
                    const existing = patient.procedureDurationHistory || [];
                    const existingIds = new Set(existing.map(l => l.id));
                    
                    // Filter logs that are in localStorage but not in parent state
                    const missingLogs = savedLogs.filter(l => !existingIds.has(l.id));
                    
                    if (missingLogs.length > 0) {
                        // Merge and sort logs by timestamp
                        const merged = [...existing, ...missingLogs].sort((a, b) => {
                            const aTs = parseInt(a.id.replace('p_duration_', ''), 10) || 0;
                            const bTs = parseInt(b.id.replace('p_duration_', ''), 10) || 0;
                            return bTs - aTs;
                        });
                        
                        updatePatient(patient.id, {
                            procedureDurationHistory: merged
                        });
                    }
                }
            } else {
                // Keep the localStorage backup in sync if parent has logs but database copy is missing
                const existing = patient.procedureDurationHistory || [];
                if (existing.length > 0) {
                    localStorage.setItem(`gmed_proc_logs_${patient.id}`, JSON.stringify(existing));
                }
            }
        } catch (e) {
            console.error("Failed to restore logs from EMR local database:", e);
        }
    }, [patient.id]);

    // Timer logic for active stopwatch
    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setTime((prevTime) => prevTime + 1);
            }, 1000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning]);

    // Keep "now" updated every second so the live countdown ticks in real-time
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const handleStartPause = () => {
        setError('');
        setSuccessMessage('');
        setIsRunning(!isRunning);
    };

    const handleReset = () => {
        setIsRunning(false);
        setTime(0);
        setError('');
        setSuccessMessage('');
    };

    // Format seconds into HH:MM:SS
    const formatTime = (totalSeconds: number) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        return {
            hours: String(hrs).padStart(2, '0'),
            minutes: String(mins).padStart(2, '0'),
            seconds: String(secs).padStart(2, '0'),
            formatted: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        };
    };

    // Nice text formatting for duration, e.g. "1h 45m" or "45s"
    const formatDurationText = (totalSeconds: number) => {
        if (totalSeconds === 0) return '0s';
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        const parts = [];
        if (hrs > 0) parts.push(`${hrs} hr${hrs > 1 ? 's' : ''}`);
        if (mins > 0) parts.push(`${mins} min${mins > 1 ? 's' : ''}`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs} sec${secs > 1 ? 's' : ''}`);

        return parts.join(' ');
    };

    const getActiveProcedureName = () => {
        return selectedProcType === 'Manual' ? manualProcName.trim() : selectedProcType;
    };

    const handleLogProcedure = () => {
        setError('');
        setSuccessMessage('');

        const procName = getActiveProcedureName();
        if (!procName) {
            setError('Please select or specify a procedure name.');
            return;
        }

        if (time <= 0) {
            setError('Timer is at 0. Start the timer to track procedure duration.');
            return;
        }

        const currentDate = new Date();
        const dateString = currentDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Unique ID for the log entry
        const newLog = {
            id: 'p_duration_' + Date.now(),
            date: dateString,
            procedureName: procName,
            durationSeconds: time,
            notes: clinicalNotes.trim() || undefined
        };

        const existingLogs = patient.procedureDurationHistory || [];
        const updatedLogs = [newLog, ...existingLogs];

        // Format duration for the log appending Action
        const loggedDurationLabel = formatDurationText(time);
        const appendText = `\n- Procedural Record: ${procName} (Duration: ${loggedDurationLabel})${clinicalNotes.trim() ? ` - Notes: ${clinicalNotes.trim()}` : ''}`;

        // Build updated daily SOAP progress notes
        let updatedDailyNotes: DailyProgressNote[] = [...(patient.dailyNotes || [])];
        if (updatedDailyNotes.length > 0) {
            const latestNote = { ...updatedDailyNotes[0] };
            latestNote.objective = latestNote.objective 
                ? `${latestNote.objective.trim()}${appendText}`
                : `Procedural Record: ${procName} (Duration: ${loggedDurationLabel})${clinicalNotes.trim() ? ` - Notes: ${clinicalNotes.trim()}` : ''}`;
            updatedDailyNotes[0] = latestNote;
        } else {
            const newNote: DailyProgressNote = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                vitals: { bp: '', pulse: 0, temp: 0, rr: 18, spo2: 0, timestamp: new Date().toISOString() },
                subjective: 'Post-operative / procedural monitoring.',
                objective: `Procedural Record: ${procName} (Duration: ${loggedDurationLabel})${clinicalNotes.trim() ? ` - Notes: ${clinicalNotes.trim()}` : ''}`,
                assessment: `${procName} completed.`,
                plan: 'Post-operative monitoring and routine clinical care.',
                addedBy: 'Resident'
            };
            updatedDailyNotes = [newNote];
        }

        // Also append/sync to the single-text soapNote for fallback and complete assurance
        const updatedSoapNote = patient.soapNote 
            ? `${patient.soapNote.trim()}${appendText}`
            : `Procedural Record: ${procName} (Duration: ${loggedDurationLabel})${clinicalNotes.trim() ? ` - Notes: ${clinicalNotes.trim()}` : ''}`;

        // Save to EMR local database (localStorage)
        try {
            localStorage.setItem(`gmed_proc_logs_${patient.id}`, JSON.stringify(updatedLogs));
        } catch (e) {
            console.error("Local database auto-save error:", e);
        }

        // Call parent updaters with updated logs, dailyNotes, and soapNote
        updatePatient(patient.id, {
            procedureDurationHistory: updatedLogs,
            // Automatically log current procedure if not already set, or help sync
            surgicalProcedure: patient.surgicalProcedure ? patient.surgicalProcedure : procName,
            dailyNotes: updatedDailyNotes,
            soapNote: updatedSoapNote
        });

        setSuccessMessage(`Success! Logged "${procName}" with a duration of ${loggedDurationLabel} (Appended to SOAP progress notes & database updated)`);
        
        // Reset timer states but keep procedure inputs
        setIsRunning(false);
        setTime(0);
        setClinicalNotes('');

        // Flash auto-fade success
        setTimeout(() => {
            setSuccessMessage('');
        }, 5000);
    };

    const handleDeleteLog = (logId: string) => {
        const existingLogs = patient.procedureDurationHistory || [];
        const updatedLogs = existingLogs.filter((log) => log.id !== logId);
        
        try {
            localStorage.setItem(`gmed_proc_logs_${patient.id}`, JSON.stringify(updatedLogs));
        } catch (e) {
            console.error("Local database auto-save error (delete):", e);
        }

        updatePatient(patient.id, {
            procedureDurationHistory: updatedLogs
        });
    };

    // Countdown utilities
    const getCountdown = (plannedTimeString?: string) => {
        if (!plannedTimeString) return null;
        const target = new Date(plannedTimeString);
        
        // Check for invalid dates
        if (isNaN(target.getTime())) return null;

        const diffMs = target.getTime() - now.getTime();
        const isPast = diffMs < 0;
        const absDiffMs = Math.abs(diffMs);

        const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);

        return {
            days,
            hours,
            minutes,
            seconds,
            isPast,
            absoluteMinutes: Math.floor(absDiffMs / 60000),
            formattedDiff: `${days}d ${hours}h ${minutes}m ${seconds}s`
        };
    };

    const applyPreset = (presetType: '30m' | '1h' | '3h' | '6h' | 'tomorrow_8am') => {
        const base = new Date();
        if (presetType === '30m') {
            base.setMinutes(base.getMinutes() + 30);
        } else if (presetType === '1h') {
            base.setHours(base.getHours() + 1);
        } else if (presetType === '3h') {
            base.setHours(base.getHours() + 3);
        } else if (presetType === '6h') {
            base.setHours(base.getHours() + 6);
        } else if (presetType === 'tomorrow_8am') {
            base.setDate(base.getDate() + 1);
            base.setHours(8, 0, 0, 0);
        }

        // Convert to YYYY-MM-DDTHH:MM format required by input type="datetime-local"
        const year = base.getFullYear();
        const month = String(base.getMonth() + 1).padStart(2, '0');
        const date = String(base.getDate()).padStart(2, '0');
        const hours = String(base.getHours()).padStart(2, '0');
        const minutes = String(base.getMinutes()).padStart(2, '0');
        const isoLocalString = `${year}-${month}-${date}T${hours}:${minutes}`;

        setPlannedTimeInput(isoLocalString);
        setError('');
    };

    const handleSaveCountdown = () => {
        setError('');
        setSuccessMessage('');

        if (!plannedTimeInput) {
            setError('Please select or specify a scheduled surgery time.');
            return;
        }

        const scheduledDate = new Date(plannedTimeInput);
        if (isNaN(scheduledDate.getTime())) {
            setError('Invalid date-time specified.');
            return;
        }

        updatePatient(patient.id, {
            plannedSurgeryTime: plannedTimeInput
        });

        // Use active procedure if present, otherwise set planned info
        const displayProc = getActiveProcedureName() || patient.surgicalProcedure || 'Ortho Surgery';
        setSuccessMessage(`Success! Updated Countdown schedule for "${displayProc}"`);

        setTimeout(() => {
            setSuccessMessage('');
        }, 4000);
    };

    const handleClearCountdown = () => {
        setError('');
        setSuccessMessage('');
        setPlannedTimeInput('');
        updatePatient(patient.id, {
            plannedSurgeryTime: undefined
        });
        setSuccessMessage('Surgical countdown timer cleared.');
        setTimeout(() => {
            setSuccessMessage('');
        }, 4000);
    };

    const logs = patient.procedureDurationHistory || [];
    const totalCount = logs.length;
    const totalSeconds = logs.reduce((acc, curr) => acc + curr.durationSeconds, 0);
    const averageSeconds = totalCount > 0 ? Math.round(totalSeconds / totalCount) : 0;

    const timeParts = formatTime(time);
    const countdown = getCountdown(patient.plannedSurgeryTime);

    return (
        <div id="procedure-timer-tracker" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Core Interactive Stopwatch Block */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
                    
                    {/* Professional Header with Segment Tab Selectors */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 shrink-0">
                            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400">
                                <Timer className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Procedural Cockpit</h4>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-450 border border-emerald-100/60 dark:border-emerald-800/20 select-none">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Auto-Save Active
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-550 font-medium leading-tight">G-MED Surgical Stopwatch & Countdown Scheduler</p>
                            </div>
                        </div>
                        
                        <div className="flex bg-slate-150 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/80 self-start sm:self-auto shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveSubTab('stopwatch');
                                    setError('');
                                    setSuccessMessage('');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                    activeSubTab === 'stopwatch'
                                        ? 'bg-white dark:bg-slate-900 text-[#0077b6] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-450 dark:hover:text-slate-200'
                                }`}
                            >
                                <Timer className="h-3.5 w-3.5" /> Tracker
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveSubTab('countdown');
                                    setError('');
                                    setSuccessMessage('');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                    activeSubTab === 'countdown'
                                        ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-450 dark:hover:text-slate-200'
                                }`}
                            >
                                <Hourglass className="h-3.5 w-3.5" /> Countdown
                            </button>
                        </div>
                    </div>

                    {/* View Switch: Active Stopwatch vs Countdown */}
                    {activeSubTab === 'stopwatch' ? (
                        <div className="p-6 flex flex-col items-center justify-center space-y-6">
                            
                            {/* Digital Monospace Clock readout */}
                            <div className="flex flex-col items-center space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#0077b6]">Elapsed Duration</span>
                                <div className="flex items-center gap-2">
                                    <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-inner flex gap-1">
                                        <span className={isRunning ? 'text-emerald-605 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}>
                                            {timeParts.hours}
                                        </span>
                                        <span className="text-slate-350 dark:text-slate-600 animate-pulse">:</span>
                                        <span className={isRunning ? 'text-emerald-605 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}>
                                            {timeParts.minutes}
                                        </span>
                                        <span className="text-slate-350 dark:text-slate-600 animate-pulse">:</span>
                                        <span className={isRunning ? 'text-emerald-605 dark:text-emerald-400 animate-pulse' : 'text-slate-700 dark:text-slate-300'}>
                                            {timeParts.seconds}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Interactive Stopwatch controls */}
                            <div className="flex items-center gap-3 w-full max-w-sm justify-center">
                                <button
                                    onClick={handleStartPause}
                                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 border cursor-pointer
                                        ${isRunning 
                                            ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400 shadow-amber-100 dark:shadow-none' 
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-emerald-105 dark:shadow-none'}`}
                                >
                                    {isRunning ? (
                                        <>
                                            <Pause className="h-4 w-4 fill-current" /> Pause
                                        </>
                                    ) : (
                                        <>
                                            <Play className="h-4 w-4 fill-current" /> Start Timer
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="p-3 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm transition-colors cursor-pointer"
                                    title="Reset Stopwatch"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Dropdown selectors for procedure identification */}
                            <div className="w-full max-w-md bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase mb-1 tracking-widest">Select Orthopedic Procedure</label>
                                    <CustomSearchableDropdown
                                        value={selectedProcType}
                                        onChange={(val) => setSelectedProcType(val)}
                                        options={[
                                            { value: "Manual", label: "-- Enter Custom / Type Manually --" },
                                            ...COMMON_PROCEDURES.map((proc) => ({ value: proc, label: proc }))
                                        ]}
                                        placeholder="Select Orthopedic Procedure..."
                                    />
                                </div>

                                {selectedProcType === 'Manual' && (
                                    <div className="animate-fade-in">
                                        <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase mb-1 tracking-widest">Procedure Description</label>
                                        <input
                                            type="text"
                                            placeholder="Describe surgical procedure manually..."
                                            value={manualProcName}
                                            onChange={(e) => setManualProcName(e.target.value)}
                                            className="w-full text-xs font-semibold p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6] dark:text-white"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase mb-1 tracking-widest">Clinical Notes / Context (Optional)</label>
                                    <textarea
                                        placeholder="Enter procedure details, implant specs, anesthesia type, or any context..."
                                        value={clinicalNotes}
                                        onChange={(e) => setClinicalNotes(e.target.value)}
                                        rows={2}
                                        className="w-full text-xs font-semibold p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-[#0077b6] dark:text-white resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Surgical Countdown Timer Panel */
                        <div className="p-6 flex flex-col space-y-6">
                            {countdown ? (
                                <div className="space-y-6 flex flex-col items-center">
                                    {/* Countdown Live State Badge */}
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 border ${
                                            countdown.isPast
                                                ? 'bg-red-50 dark:bg-red-950/30 text-red-650 border-red-200 dark:border-red-900/30 animate-pulse'
                                                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-200 dark:border-emerald-900/40'
                                        }`}>
                                            <span className={`h-2 w-2 rounded-full ${countdown.isPast ? 'bg-red-600 animate-ping' : 'bg-emerald-555'}`} />
                                            {countdown.isPast ? 'Surgery Active / Overdue' : 'Planned Surgery Pending'}
                                        </span>
                                    </div>

                                    {/* Digital Countdown Box Blocks */}
                                    <div className="flex flex-col items-center space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                            {countdown.isPast ? 'Overdue Elapsed Time' : 'Time Remaining Until Incision'}
                                        </span>
                                        
                                        <div className="grid grid-cols-4 gap-2 text-center max-w-sm w-full mx-auto mt-2">
                                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-850 shadow-inner flex flex-col">
                                                <span className="text-2xl font-black font-mono text-slate-805 dark:text-slate-100">
                                                    {String(countdown.days).padStart(2, '0')}
                                                </span>
                                                <span className="text-[8px] font-extrabold text-slate-400 uppercase mt-0.5 tracking-wider">Days</span>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-850 shadow-inner flex flex-col">
                                                <span className="text-2xl font-black font-mono text-slate-805 dark:text-slate-100">
                                                    {String(countdown.hours).padStart(2, '0')}
                                                </span>
                                                <span className="text-[8px] font-extrabold text-slate-400 uppercase mt-0.5 tracking-wider">Hrs</span>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-850 shadow-inner flex flex-col">
                                                <span className="text-2xl font-black font-mono text-slate-805 dark:text-slate-100">
                                                    {String(countdown.minutes).padStart(2, '0')}
                                                </span>
                                                <span className="text-[8px] font-extrabold text-slate-400 uppercase mt-0.5 tracking-wider">Mins</span>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-850 shadow-inner flex flex-col">
                                                <span className="text-2xl font-black font-mono text-slate-850 dark:text-slate-100 animate-pulse">
                                                    {String(countdown.seconds).padStart(2, '0')}
                                                </span>
                                                <span className="text-[8px] font-extrabold text-slate-400 uppercase mt-0.5 tracking-wider">Secs</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Surgery Details Context */}
                                    <div className="w-full max-w-md bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850/80 rounded-xl p-4 text-center text-xs space-y-1.5">
                                        <div className="text-slate-450 dark:text-slate-500 font-extrabold text-[9px] uppercase tracking-widest">Scheduled Target</div>
                                        <div className="font-bold text-slate-800 dark:text-slate-250 flex items-center justify-center gap-1.5">
                                            <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
                                            <span>
                                                {new Date(patient.plannedSurgeryTime).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                        <div className="font-semibold text-[11px] text-slate-500 uppercase tracking-tight">
                                            Procedure: <span className="font-bold text-[#0077b6]">{getActiveProcedureName() || patient.surgicalProcedure || 'Unspecified Surgery'}</span>
                                        </div>
                                    </div>

                                    {/* Action items */}
                                    <div className="flex items-center gap-3 w-full max-w-xs justify-center">
                                        <button
                                            type="button"
                                            onClick={handleClearCountdown}
                                            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 bg-slate-100 hover:bg-red-50 dark:bg-slate-850 dark:hover:bg-red-950/20 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Trash className="h-3.5 w-3.5" /> Clear Schedule
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // Trigger stopwatch directly
                                                setActiveSubTab('stopwatch');
                                                setIsRunning(true);
                                                setSuccessMessage('Stopwatch started directly from Scheduled incision target!');
                                                setTimeout(() => setSuccessMessage(''), 3000);
                                            }}
                                            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold text-white bg-[#0077b6] hover:bg-[#005f92] shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Play className="h-3.5 w-3.5 fill-current" /> Start Surgery
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Configuration Form */
                                <div className="space-y-4 max-w-md w-full mx-auto">
                                    <div className="text-center space-y-1 py-2">
                                        <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 mb-2">
                                            <Calendar className="h-5 w-5" />
                                        </div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Schedule Incision Hour</h4>
                                        <p className="text-[10px] text-slate-450 leading-normal max-w-xs mx-auto">Plan the upcoming orthopedic surgery target time to enable a live countdown banner.</p>
                                    </div>

                                    {/* Target Datetime-local selector */}
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-slate-455 dark:text-slate-500 uppercase tracking-widest">Planned Incision date & time</label>
                                        <input
                                            type="datetime-local"
                                            value={plannedTimeInput}
                                            onChange={(e) => {
                                                setPlannedTimeInput(e.target.value);
                                                setError('');
                                            }}
                                            className="w-full text-xs font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-905 border border-slate-205 dark:border-slate-800 p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-emerald-600 dark:color-scheme-dark"
                                        />
                                    </div>

                                    {/* Quick Preset Buttons */}
                                    <div className="space-y-1.5">
                                        <span className="block text-[10px] font-black text-slate-455 dark:text-slate-500 uppercase tracking-widest mb-1">Quick Scheduling Presets</span>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => applyPreset('30m')}
                                                className="py-2 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-lg text-2xs font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                            >
                                                +30 Mins
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyPreset('1h')}
                                                className="py-2 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-lg text-2xs font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                            >
                                                +1 Hour
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyPreset('3h')}
                                                className="py-2 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-lg text-2xs font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                            >
                                                +3 Changeover
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyPreset('6h')}
                                                className="py-2 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-lg text-2xs font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                            >
                                                +6 Night Shift
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyPreset('tomorrow_8am')}
                                                className="py-2 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850/60 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-350 rounded-lg text-2xs font-extrabold flex items-center justify-center gap-1 transition-colors col-span-2 sm:col-span-1 cursor-pointer"
                                            >
                                                ☀️ Tomorrow 8 AM
                                            </button>
                                        </div>
                                    </div>

                                    {/* Activate incisional tracking target Button */}
                                    <button
                                        type="button"
                                        onClick={handleSaveCountdown}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" /> Start Live Countdown
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status & Alerts section */}
                    <div className="px-6 pb-4">
                        {error && (
                            <div className="w-full text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-xl flex items-center gap-2 border border-red-150 dark:border-red-900/30">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {successMessage && (
                            <div className="w-full text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 rounded-xl flex items-center gap-2 border border-emerald-150 dark:border-emerald-900/30 animate-pulse">
                                <CheckCircle className="h-4 w-4 shrink-0" />
                                <span>{successMessage}</span>
                            </div>
                        )}
                    </div>

                    {/* Footer Area */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[150px] sm:max-w-none">
                            Patient: <span className="text-slate-650 dark:text-slate-300">{patient.demographics.name}</span>
                        </div>
                        {activeSubTab === 'stopwatch' && (
                            <button
                                type="button"
                                onClick={handleLogProcedure}
                                className="px-5 py-2.5 bg-[#0077b6] hover:bg-[#005f92] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                            >
                                <Plus className="h-4 w-4" /> Save & Log Duration
                            </button>
                        )}
                    </div>
                </div>

                {/* Database Metrics & Historic Logs */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    
                    {/* Log Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-sm text-center">
                            <span className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-500 tracking-wider block mb-1">Total Logs</span>
                            <span className="text-xl font-black text-slate-800 dark:text-slate-200 font-mono">{totalCount}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-sm text-center col-span-2">
                            <span className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-500 tracking-wider block mb-1">Total Tracked Time</span>
                            <span className="text-sm font-extrabold text-slate-850 dark:text-slate-200 truncate block mt-1" title={formatDurationText(totalSeconds)}>
                                {formatDurationText(totalSeconds)}
                            </span>
                        </div>
                    </div>

                    {/* Stats details / Avg */}
                    {totalCount > 0 && (
                        <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-105 dark:border-blue-900/30 p-3 rounded-xl flex items-center justify-between text-xs text-blue-750 dark:text-blue-400">
                            <span className="font-semibold flex items-center gap-1.5">
                                <Clock className="h-4 w-4" /> Average Procedure Duration:
                            </span>
                            <span className="font-mono font-black">{formatDurationText(averageSeconds)}</span>
                        </div>
                    )}

                    {/* D3 Surgical Duration Trend Chart */}
                    <DurationTrendChart logs={logs} />

                    {/* Timeline of Surgery Logs */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden max-h-[350px]">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-[#0077b6]" />
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-450 tracking-wider">Logged Procedure History</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                                    <Clock className="h-8 w-8 mb-2 opacity-30" />
                                    <p className="text-xs font-semibold">No surgical procedures logged yet.</p>
                                    <p className="text-[10px] opacity-75 mt-0.5 max-w-[200px] leading-snug">Track an active procedure on the stopwatch to commit logs.</p>
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div 
                                        key={log.id} 
                                        className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl flex items-start justify-between gap-3 text-xs"
                                    >
                                        <div className="space-y-1 flex-1">
                                            <div className="font-black text-slate-800 dark:text-slate-200 leading-tight text-left">
                                                {log.procedureName}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-450 font-medium">
                                                <span>{log.date}</span>
                                                <span>•</span>
                                                <span className="font-mono font-bold text-slate-605 dark:text-slate-400">
                                                    Raw: {log.durationSeconds}s
                                                </span>
                                            </div>
                                            {log.notes && (
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-205/50 dark:border-slate-800/40 mt-1.5 italic leading-relaxed whitespace-pre-wrap text-left">
                                                    {log.notes}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="font-mono font-black bg-blue-50 dark:bg-blue-900/20 text-[#0077b6] dark:text-blue-400 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900/30 whitespace-nowrap">
                                                {formatDurationText(log.durationSeconds)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteLog(log.id)}
                                                className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 p-1 rounded-lg hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer"
                                                title="Delete Log"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>

            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium italic flex items-center gap-1.5 justify-center">
                <AlertTriangle className="h-3 w-3" />
                <span>AI Advisory: Procedure stopwatch durations and countdown targets logged are permanent additions to this patient's case profile. Please verify logs prior to ward rounds.</span>
            </div>
        </div>
    );
}
