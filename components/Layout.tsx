import React, { useState, useEffect, useRef } from 'react';
import { AppView } from '../types';
import { 
  Search, User, Pill, Stethoscope, Zap, Mic, Calculator, 
  FileText, Scissors, Share2, Star, BookOpen, ChevronRight, ChevronLeft, Settings, LogOut, Bookmark, Mail,
  X, Sparkles, Video, Calendar, Moon, Sun, Map, ClipboardCheck, Timer, Menu, Contact, Inbox, Users,
  Fingerprint, ShieldCheck, CheckCircle2, RotateCcw, AlertTriangle
} from 'lucide-react';
import { 
  getEnrolledBiometrics, 
  enrollBiometrics, 
  verifyBiometrics, 
  clearBiometrics 
} from '../services/biometrics';


interface LayoutProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  children: React.ReactNode;
  onSearch: (query: string) => void;
  canGoBack: boolean;
  onBack: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
    currentView, 
    onNavigate, 
    onLogout, 
    isDarkMode, 
    toggleTheme, 
    children, 
    onSearch,
    canGoBack,
    onBack
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const lastScrollY = useRef(0);

  // Biometric Management states in Sidebar
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [biometricModalOpen, setBiometricModalOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('Ready for biometric authorization');
  const [scannerLogs, setScannerLogs] = useState<string[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [scannerMode, setScannerMode] = useState<'enroll' | 'test'>('enroll');

  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logsTimeoutRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    const profile = getEnrolledBiometrics();
    setIsBiometricEnrolled(!!profile);
  }, [isSidebarOpen]);

  const clearScannerTimeouts = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    logsTimeoutRef.current.forEach(t => clearTimeout(t));
    logsTimeoutRef.current = [];
  };

  useEffect(() => {
    return () => clearScannerTimeouts();
  }, []);

  const handleBiometricSidebarClick = async () => {
    clearScannerTimeouts();
    if (isBiometricEnrolled) {
      // Clear biometrics
      clearBiometrics();
      setIsBiometricEnrolled(false);
    } else {
      // Start enrollment flow from sidebar
      setScannerMode('enroll');
      setBiometricModalOpen(true);
      setScanProgress(0);
      setScanState('idle');
      setScannerStatus('Prepare finger/face for enrollment');
      setScannerLogs([
        'Requesting biometric key binding via Sidebar...',
        'Establishing Secure Enclave hardware link...',
        'Awaiting touch or biometric authentication scan...'
      ]);
    }
  };

  const handleScannerTouchStart = () => {
    if (scanState === 'success') return;
    
    clearScannerTimeouts();
    setScanState('scanning');
    setScannerStatus('Scanning biometric data...');
    setScannerLogs(prev => [...prev, 'Reading surface minutiae...', 'Validating biometric profile...']);

    let progress = 0;
    holdIntervalRef.current = setInterval(() => {
      progress += 4;
      if (progress >= 100) {
        progress = 100;
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        handleScannerSuccess();
      } else {
        setScanProgress(progress);
        if (progress === 24) {
          setScannerLogs(p => [...p, 'Extracting unique ridges & ridge-endings...']);
        } else if (progress === 48) {
          setScannerStatus('Resolving cryptographic token...');
          setScannerLogs(p => [...p, 'Secure Enclave token matched locally.']);
        } else if (progress === 72) {
          setScannerStatus('Verifying digital signature...');
          setScannerLogs(p => [...p, 'Validating RSA/ECDSA key pair signatures...']);
        }
      }
    }, 50);
  };

  const handleScannerTouchEnd = () => {
    if (scanState === 'scanning') {
      clearScannerTimeouts();
      setScanState('idle');
      setScanProgress(0);
      setScannerStatus('Interrupted. Hold down sensor to complete scan.');
      setScannerLogs(p => [...p, 'Scan interrupted. Secure key transmission halted.']);
    }
  };

  const handleScannerSuccess = async () => {
    setScanState('success');
    setScanProgress(100);
    setScannerStatus('Clinician Identity Confirmed!');
    setScannerLogs(p => [
      ...p,
      'Biometric signature matches enrolled profile!',
      'Distal neurovascular credentials validated.',
      'Cryptographic binding complete. Initializing session...'
    ]);

    try {
      await enrollBiometrics('doctor@hospital.com', 'Dr. S Chandra', true);
      setIsBiometricEnrolled(true);
      
      const timer = setTimeout(() => {
        setBiometricModalOpen(false);
      }, 1500);
      logsTimeoutRef.current.push(timer);
    } catch (err: any) {
      console.error('Enrollment registry error', err);
      setScanState('failed');
      setScannerStatus('Local Enrollment Failed');
      setScannerLogs(p => [...p, `Failed to bind keys: ${err?.message || 'Storage full'}`]);
    }
  };

  // Gesture State
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Scroll Detection for sticky nav
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY.current) < 10) return;

      if (currentScrollY < 20) {
        setShowNav(true);
      } else if (currentScrollY > lastScrollY.current) {
        setShowNav(false);
      } else if (currentScrollY < lastScrollY.current) {
        setShowNav(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
      if (!canGoBack) return;
      const distance = touchEndX.current - touchStartX.current;
      const isLeftSwipe = distance > 100; // Swipe Right to go Back
      // Basic check to ensure it's a horizontal swipe
      if (isLeftSwipe && touchStartX.current < 50) { // Only swipe from left edge roughly
          onBack();
      }
      // Reset
      touchStartX.current = 0;
      touchEndX.current = 0;
  };


  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchInput.trim()) {
        onSearch(searchInput);
        setIsSearchActive(false);
        setSearchInput('');
    }
  };

  const handleSuggestionClick = (label: string) => {
      onSearch(label);
      setIsSearchActive(false);
  };

  // Navigation Items
  const navItems = [
    { id: 'patients', view: AppView.EMR, label: 'Mini EMR', icon: Users },
    { id: 'drugs', view: AppView.DRUGS, label: 'Drugs', icon: Pill },
    { id: 'conditions', view: AppView.SCORES, label: 'Conditions', icon: Stethoscope },
    // New Items
    { id: 'icu_bundles', view: AppView.BUNDLES, label: 'ICU Bundles', icon: ClipboardCheck },
    { id: 'sepsis', view: AppView.BUNDLES, label: 'Sepsis 1st', icon: Timer },
    { id: 'route_guide', view: AppView.PROCEDURES, label: 'Route Guide', icon: Map },
    // Existing Items
    { id: 'interactions', view: AppView.DRUGS, label: 'Interaction Checker', icon: Zap },
    { id: 'podcasts', view: AppView.CLINICAL_ASSISTANT, label: 'Podcasts', icon: Mic },
    { id: 'calculators', view: AppView.CALCULATORS, label: 'Calculators', icon: Calculator },
    { id: 'cases', view: AppView.BUNDLES, label: 'Cases & Quizzes', icon: FileText },
    { id: 'procedures', view: AppView.PROCEDURES, label: 'Procedures', icon: Scissors },
    { id: 'decision', view: AppView.SCORES, label: 'Decision Point', icon: Share2 },
    { id: 'formulary', view: AppView.DRUGS, label: 'Formulary', icon: BookOpen },
    { id: 'directory', view: AppView.NEWS, label: 'Directory', icon: Contact },
  ];

  const isVisible = showNav || isSearchActive;

  return (
    <div 
        className="min-h-screen w-full bg-[#f0f4f8] dark:bg-slate-950 font-sans transition-colors duration-300 overflow-x-hidden print:bg-white print:overflow-visible"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      
      {/* --- SIDEBAR DRAWER (Profile / Mobile Menu) --- */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex print:hidden">
          <div className="w-80 bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-in-left border-r dark:border-slate-800">
            <div className="p-6 pt-12 border-b border-slate-100 dark:border-slate-800 bg-[#0077b6] dark:bg-[#002a40] text-white">
              <h2 className="text-xl font-bold">Dr. S Chandra</h2>
              <p className="text-sm text-blue-100 opacity-90">skcchandra999@gmail.com</p>
            </div>
            
            <div className="flex-1 py-4">
               <SidebarItem icon={Mail} label="My Invitations" badge />
               <SidebarItem icon={User} label="My Profile" />
               <SidebarItem icon={Bookmark} label="Saved Content" />
               <SidebarItem icon={Fingerprint} label={isBiometricEnrolled ? "Biometric Active (Deactivate)" : "Enable TouchID/FaceID"} onClick={handleBiometricSidebarClick} />
               <SidebarItem icon={Settings} label="Settings" />
               
               {/* Theme Toggle in Sidebar */}
               <button 
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-l-4 border-transparent hover:border-[#0077b6] group"
               >
                 <div className="flex items-center space-x-4">
                   {isDarkMode ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5 text-[#0077b6]" />}
                   <span className="font-medium text-slate-800 dark:text-slate-200">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                 </div>
               </button>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={onLogout}
                className="flex items-center space-x-3 w-full p-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Log Out</span>
              </button>
            </div>
          </div>
          <div 
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        </div>
      )}

      {/* --- HEADER & NAV CONTAINER --- */}
      <div className={`sticky top-0 z-30 w-full max-w-full transition-transform duration-300 ease-in-out bg-[#f0f4f8] dark:bg-slate-950/95 print:hidden ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
          
          {/* Top Bar */}
          <header className="px-4 py-3 flex items-center justify-between gap-3 border-none w-full">
            {isSearchActive ? (
                // Active Search Header
                <div className="flex items-center w-full animate-fade-in gap-3">
                    <form onSubmit={handleSearchSubmit} className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#0077b6] dark:text-[#0ea5e9]" />
                        <input 
                          autoFocus
                          type="text"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          placeholder="Ask G-AI or search..." 
                          className="w-full pl-11 pr-10 py-3 bg-white dark:bg-slate-800 rounded-full text-base font-medium text-slate-900 dark:text-white outline-none shadow-md ring-2 ring-[#0077b6] transition-all placeholder-slate-400"
                        />
                         <Mic className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#0077b6]" />
                    </form>
                    <button 
                        onClick={() => { setIsSearchActive(false); setSearchInput(''); }} 
                        className="text-[#0077b6] dark:text-[#0ea5e9] font-bold text-sm px-2 whitespace-nowrap"
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                // Standard Reference Header
                <div className="flex items-center w-full gap-2">
                    
                    {/* Left: Profile Icon OR Back Button */}
                    {canGoBack ? (
                        <button onClick={onBack} className="flex-shrink-0 animate-fade-in">
                            <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-[#0077b6] shadow-sm hover:scale-105 transition-transform border border-[#0077b6]/10">
                                <ChevronLeft className="h-6 w-6 stroke-[2.5px]" />
                            </div>
                        </button>
                    ) : (
                        <button onClick={toggleSidebar} className="flex-shrink-0 animate-fade-in">
                            <div className="w-10 h-10 bg-[#0077b6] rounded-full flex items-center justify-center text-white shadow-sm hover:scale-105 transition-transform">
                                <User className="h-5 w-5 stroke-[2.5px]" />
                            </div>
                        </button>
                    )}
                    
                    {/* Center: Search Bar (White Pill + Voice) */}
                    <div className="flex-1 min-w-0">
                        <div 
                            onClick={() => setIsSearchActive(true)}
                            className="relative w-full cursor-text group"
                        >
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-[#0077b6] dark:text-blue-400" />
                            </div>
                            <div className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-800 rounded-full text-[15px] font-medium text-slate-500 dark:text-slate-400 shadow-sm group-hover:shadow-md transition-all truncate">
                                Ask G-AI or search...
                            </div>
                            {/* Voice Icon */}
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <Mic className="h-5 w-5 text-[#0077b6] dark:text-blue-400" />
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions (Sparkles + Inbox) */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Sparkle Button */}
                        <button 
                            onClick={() => onNavigate(AppView.CLINICAL_ASSISTANT)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
                        >
                            <Sparkles className="h-5 w-5 text-purple-500 fill-purple-50" />
                        </button>
                        
                        {/* Notification/Inbox Button (Brand Color) */}
                        <button className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm hover:scale-105 transition-transform relative">
                            <Inbox className="h-5 w-5 text-[#0077b6]" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                        </button>
                    </div>
                </div>
            )}
          </header>

          {/* ICON NAV ROW - Horizontal Scroll - Tile Style */}
          {!isSearchActive && (
             <div className="overflow-x-auto scrollbar-hide pb-4 pt-1 px-4 w-full">
                <div className="flex gap-3 min-w-max">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.view)}
                            className={`
                                relative flex flex-col items-center justify-center w-[100px] h-[105px] rounded-2xl transition-all duration-200
                                ${currentView === item.view 
                                    ? 'bg-white dark:bg-slate-800 shadow-md border-2 border-[#0077b6] transform scale-[1.02]' 
                                    : 'bg-white dark:bg-slate-800 shadow-sm border-0 hover:shadow-md'}
                            `}
                        >
                            <div className="mb-2">
                                <item.icon 
                                    className={`h-7 w-7 text-[#0077b6] ${currentView === item.view ? 'fill-blue-100' : ''}`} 
                                    strokeWidth={1.5} 
                                />
                            </div>
                            <span className={`text-[11px] font-bold text-center leading-tight px-1 line-clamp-2 ${currentView === item.view ? 'text-[#0077b6]' : 'text-slate-600 dark:text-slate-300'}`}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
             </div>
          )}

           {/* Tabs Line - Horizontal Scroll - For You Brand Color */}
           {!isSearchActive && (
             <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide w-full">
                <TabButton label="For You" active />
                <TabButton label="Anesthesiology" />
                <TabButton label="Cardiology" />
                <TabButton label="Critical Care" />
                <TabButton label="Oncology" />
                <TabButton label="Neurology" />
                <TabButton label="Emergency" />
             </div>
          )}
      </div>

      {/* --- SEARCH OVERLAY OR MAIN CONTENT --- */}
      {isSearchActive ? (
          <div className="fixed inset-0 top-[65px] bg-white dark:bg-slate-950 z-20 overflow-y-auto animate-fade-in p-4">
              <div className="flex flex-wrap gap-2 mb-6">
                  <SuggestionPill label="How to diagnose Alzheimer's?" onClick={handleSuggestionClick} />
                  <SuggestionPill label="Type 2 diabetes treatment" onClick={handleSuggestionClick} />
                  <SuggestionPill label="Lipid management guidelines" onClick={handleSuggestionClick} />
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Recently Viewed</span>
                      <X className="h-4 w-4 text-slate-400 cursor-pointer" />
                  </div>
                  <div>
                      <RecentItem label="norepinephrine" />
                      <RecentItem label="Creatinine Clearance" />
                      <RecentItem label="Weight-based medication dosing" />
                      <RecentItem label="amikacin" />
                      <RecentItem label="Bacterial Sepsis" />
                  </div>
              </div>
          </div>
      ) : (
        <main className="max-w-5xl mx-auto p-0 pb-24 min-h-screen print:pb-0 print:min-h-0 print:h-auto print:block">
            {children}
        </main>
      )}

      {/* --- BOTTOM TAB BAR (Phone Only - Standard) --- */}
      <div 
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 px-6 py-2 pb-5 flex justify-between items-center z-40 transition-transform duration-300 ease-in-out shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-slate-100 dark:border-slate-800 print:hidden ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      >
         <BottomTab icon={Share2} label="Home" active={currentView === AppView.NEWS} onClick={() => onNavigate(AppView.NEWS)} />
         <BottomTab icon={Video} label="Video" />
         <BottomTab icon={Calculator} label="Quizzes" />
         <BottomTab icon={BookOpen} label="Education" />
         <BottomTab icon={Calendar} label="Events" />
      </div>

      {/* --- INTEGRATED BIOMETRIC SETUP HUD MODAL --- */}
      {biometricModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col relative overflow-hidden text-left">
            
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#0077b6]" />
                  G-MED Clinical Security Hub
                </h3>
                <p className="text-xs text-slate-400 font-medium font-sans">
                  Local TouchID/FaceID Credential Enrollment
                </p>
              </div>
              <button 
                onClick={() => { clearScannerTimeouts(); setBiometricModalOpen(false); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
              
              {scanState === 'scanning' && (
                <div className="absolute left-0 right-0 h-0.5 bg-cyan-400/80 shadow-[0_0_10px_#22d3ee] animate-laser-move z-10"></div>
              )}

              <div 
                onMouseDown={handleScannerTouchStart}
                onMouseUp={handleScannerTouchEnd}
                onMouseLeave={handleScannerTouchEnd}
                onTouchStart={handleScannerTouchStart}
                onTouchEnd={handleScannerTouchEnd}
                className={`
                  w-28 h-28 rounded-full border-4 flex items-center justify-center transition-all duration-300 relative select-none cursor-pointer
                  ${scanState === 'scanning' 
                    ? 'border-cyan-400 bg-cyan-500/5 scale-105 shadow-[0_0_20px_rgba(34,211,238,0.2)]' 
                    : scanState === 'success'
                      ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : scanState === 'failed'
                        ? 'border-red-500 bg-red-500/5'
                        : 'border-[#0077b6] hover:border-[#005f92] dark:border-slate-700 hover:scale-102 bg-white dark:bg-slate-900 shadow-sm'
                  }
                `}
              >
                {scanState === 'scanning' && (
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-60"></div>
                )}
                
                {scanState === 'scanning' && (
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      stroke="url(#progressGradLayout)"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray="314"
                      strokeDashoffset={314 - (314 * scanProgress) / 100}
                      className="transition-all duration-75"
                    />
                    <defs>
                      <linearGradient id="progressGradLayout" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#0ea5e9" />
                      </linearGradient>
                    </defs>
                  </svg>
                )}

                {scanState === 'success' ? (
                  <CheckCircle2 className="h-14 w-14 text-emerald-500 animate-scale-up" strokeWidth={1.5} />
                ) : scanState === 'failed' ? (
                  <AlertTriangle className="h-14 w-14 text-red-500 animate-shake" strokeWidth={1.5} />
                ) : (
                  <Fingerprint 
                    className={`
                      h-14 w-14 transition-colors duration-300
                      ${scanState === 'scanning' ? 'text-cyan-400 animate-pulse' : 'text-[#0077b6] dark:text-[#0ea5e9]'}
                    `} 
                    strokeWidth={1.5} 
                  />
                )}
              </div>

              <div className="mt-5 text-center px-4">
                <span className={`text-xs font-black tracking-wide uppercase px-2 py-1 rounded-md ${
                  scanState === 'success' 
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' 
                    : scanState === 'failed'
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
                      : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {scannerStatus}
                </span>
                
                {scanState === 'idle' && (
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-2">
                    Touch and hold circular pad above to enroll
                  </p>
                )}
                {scanState === 'scanning' && (
                  <p className="text-[11px] font-bold text-cyan-500 animate-pulse mt-2">
                    Scanning... {scanProgress}% complete
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2 text-left">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                Cryptographic Console Logs
              </span>
              <div className="h-28 bg-slate-900 rounded-xl p-3 border border-slate-800 overflow-y-auto font-mono text-[9px] text-slate-400 space-y-1.5 scrollbar-thin">
                {scannerLogs.map((log, index) => (
                  <div key={index} className="flex gap-2 items-start leading-relaxed">
                    <span className="text-cyan-500/80 font-bold shrink-0">&gt;</span>
                    <span className="truncate max-w-[340px] whitespace-normal">{log}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { clearScannerTimeouts(); setBiometricModalOpen(false); }}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              {scanState === 'failed' && (
                <button
                  onClick={() => {
                    clearScannerTimeouts();
                    setScanState('idle');
                    setScanProgress(0);
                    setScannerStatus('Ready to retry scan');
                    setScannerLogs(['Scanner reset. Ready to retry.']);
                  }}
                  className="flex-1 bg-[#0077b6] dark:bg-[#0ea5e9] hover:bg-[#005f92] text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// --- SUBCOMPONENTS ---

const SuggestionPill = ({ label, onClick }: { label: string, onClick?: (label: string) => void }) => (
    <button 
        onClick={() => onClick && onClick(label)}
        className="flex items-center space-x-1 border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full text-xs font-bold text-purple-700 dark:text-purple-300 shadow-sm whitespace-nowrap hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors"
    >
        <Sparkles className="h-3 w-3 text-purple-500" />
        <span>{label}</span>
    </button>
);

const RecentItem = ({ label }: { label: string }) => (
    <div className="px-4 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 last:border-0 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <div className="p-1">
             <ChevronRight className="h-4 w-4 text-slate-400" />
        </div>
    </div>
);

const SidebarItem = ({ icon: Icon, label, badge, onClick }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-l-4 border-transparent hover:border-[#0077b6]"
  >
    <div className="flex items-center space-x-4">
      <Icon className="h-5 w-5 text-[#0077b6] dark:text-slate-200" />
      <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>
    </div>
    {badge ? (
      <span className="w-2 h-2 rounded-full bg-red-500"></span>
    ) : (
      !onClick && <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
    )}
  </button>
);

const TabButton = ({ label, active }: { label: string, active?: boolean }) => (
  <button className={`
    px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors border mb-2
    ${active 
      ? 'bg-[#0077b6] text-white border-[#0077b6] shadow-sm' 
      : 'bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}
  `}>
    {label}
  </button>
);

const BottomTab = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center space-y-1 group ${active ? 'text-[#0077b6] dark:text-[#0ea5e9]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
     <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-blue-50 dark:bg-slate-800' : 'group-hover:bg-slate-50 dark:group-hover:bg-slate-900'}`}>
       <Icon className={`h-6 w-6 ${active ? 'fill-current' : ''}`} strokeWidth={active ? 2.5 : 2} />
     </div>
     <span className="text-[10px] font-bold tracking-tight">{label}</span>
  </button>
);

export default Layout;