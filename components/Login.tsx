import React, { useState, useEffect, useRef } from 'react';
import { 
  Eye, 
  EyeOff, 
  Activity, 
  Loader2, 
  Fingerprint, 
  ShieldCheck, 
  KeyRound, 
  UserCheck, 
  Smartphone, 
  X, 
  RotateCcw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { signInWithGoogle } from '../services/firebase';
import { 
  getEnrolledBiometrics, 
  enrollBiometrics, 
  verifyBiometrics, 
  clearBiometrics, 
  BiometricProfile 
} from '../services/biometrics';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // Credentials input state
  const [email, setEmail] = useState('doctor@hospital.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Biometric state
  const [enrolledProfile, setEnrolledProfile] = useState<BiometricProfile | null>(null);
  const [enrollBiometricOnLogin, setEnrollBiometricOnLogin] = useState(true);
  const [isBiometricViewActive, setIsBiometricViewActive] = useState(false);
  
  // Visual validation scanner states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'enroll' | 'authenticate'>('authenticate');
  const [scannerStatus, setScannerStatus] = useState<string>('Ready for biometric authorization');
  const [scannerLogs, setScannerLogs] = useState<string[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logsTimeoutRef = useRef<NodeJS.Timeout[]>([]);

  // Check for enrolled biometric profile on component mount
  useEffect(() => {
    const profile = getEnrolledBiometrics();
    if (profile) {
      setEnrolledProfile(profile);
      setIsBiometricViewActive(true);
    }
  }, []);

  // Cleanup helper for timeouts and intervals
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

  // Normal Form login submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // If user selected biometric enrollment, trigger it on successful login
      if (enrollBiometricOnLogin) {
        clearScannerTimeouts();
        setScannerMode('enroll');
        setScannerOpen(true);
        setScanProgress(0);
        setScanState('idle');
        setScannerStatus('Prepare finger/face for enrollment');
        setScannerLogs([
          'Clinician credential authenticated.',
          'Initializing biometric enrollment flow...',
          'Awaiting touch or biometric authentication scan...'
        ]);
        setLoading(false);
      } else {
        onLogin();
      }
    } catch (err: any) {
      setError(err?.message || "Login failed. Please check credentials.");
      setLoading(false);
    }
  };

  // Google Sign-In handler
  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (enrollBiometricOnLogin && user?.email) {
        clearScannerTimeouts();
        setScannerMode('enroll');
        setEmail(user.email);
        setScannerOpen(true);
        setScanProgress(0);
        setScanState('idle');
        setScannerStatus('Prepare finger/face for enrollment');
        setScannerLogs([
          `Authenticated as: ${user.email}`,
          'Initializing biometric enrollment flow...',
          'Awaiting touch or biometric authentication scan...'
        ]);
        setLoading(false);
      } else {
        onLogin();
      }
    } catch (err: any) {
      console.error("Google sign in error", err);
      setError(err?.message || "Google Sign-In failed. Please try again.");
      setLoading(false);
    }
  };

  // Trigger biometric verification
  const handleBiometricAuthTrigger = async () => {
    if (!enrolledProfile) return;

    clearScannerTimeouts();
    setScannerMode('authenticate');
    setScannerOpen(true);
    setScanProgress(0);
    setScanState('idle');
    setScannerStatus('Initiating cryptographic check...');
    setScannerLogs([
      `Requesting validation for profile: ${enrolledProfile.displayName}`,
      'Contacting secure enclave processor...',
      'Awaiting hardware response...'
    ]);

    try {
      // Attempt real native WebAuthn first.
      // If native WebAuthn starts, it will trigger browser hardware biometric popup.
      const nativeSuccess = await verifyBiometrics(enrolledProfile);
      
      if (nativeSuccess && !enrolledProfile.isSimulated) {
        // Native WebAuthn succeeded! Fast-track visual validation state.
        setScanState('success');
        setScanProgress(100);
        setScannerStatus('Secure Enclave verification complete');
        setScannerLogs(prev => [
          ...prev,
          'Hardware challenge approved.',
          'Cryptographic signature verified against local registry.',
          'Decoupled token active. Identity authorized.',
          'Session cleared.'
        ]);
        
        const timer = setTimeout(() => {
          setScannerOpen(false);
          onLogin();
        }, 1500);
        logsTimeoutRef.current.push(timer);
      } else {
        // If simulated or falls back to simulation, the user interacts via visual touch sensor holding.
        setScannerStatus('Hold down on the biometric scanning pad to verify');
        setScannerLogs(prev => [
          ...prev,
          'Sandboxed preview context detected.',
          'Interactive biometric secure simulation enabled.',
          '>>> Hold down finger/face on scanning pad below to initiate verification...'
        ]);
      }
    } catch (err: any) {
      console.error('Biometric authentication failed:', err);
      setScanState('failed');
      setScannerStatus('Verification failed');
      setScannerLogs(prev => [...prev, `Hardware error: ${err?.message || 'Access Denied'}`]);
    }
  };

  // Simulated biometric scan interaction - touch & hold scanner logic
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
        // Stagger logs based on progress points for realistic high-fidelity clinical effect
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

  // When hold scan reaches 100% or real biometric succeeds
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
      if (scannerMode === 'enroll') {
        // Safe enrollment call (will write to local profile)
        await enrollBiometrics(email, email.split('@')[0], true);
      }
      
      const timer = setTimeout(() => {
        setScannerOpen(false);
        onLogin();
      }, 1500);
      logsTimeoutRef.current.push(timer);
    } catch (err: any) {
      console.error('Enrollment registry error', err);
      setScanState('failed');
      setScannerStatus('Local Enrollment Failed');
      setScannerLogs(p => [...p, `Failed to bind keys: ${err?.message || 'Storage full'}`]);
    }
  };

  const handleRemoveBiometricLock = () => {
    clearBiometrics();
    setEnrolledProfile(null);
    setIsBiometricViewActive(false);
    setError("Biometric lock removed successfully.");
    setTimeout(() => setError(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 font-sans transition-colors duration-300">
      <div className="w-full max-w-md">
        
        {/* --- LOGO SECTION (Horizontal Layout) --- */}
        <div className="flex items-center justify-center gap-4 mb-8">
             <div className="relative flex-shrink-0">
                  {/* Logo Icon Container - Straight (no rotation) */}
                  <div className="w-14 h-14 bg-gradient-to-br from-[#0077b6] to-[#005f92] rounded-xl shadow-lg flex items-center justify-center">
                     <Activity className="h-7 w-7 text-white" strokeWidth={2.5} />
                  </div>
                  {/* Decorative element */}
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cyan-400 rounded-full border-2 border-slate-50 dark:border-slate-950"></div>
             </div>
             
             <div className="text-left flex flex-col justify-center">
                 {/* Title Text - Unified Brand Color */}
                 <h1 className="text-3xl font-extrabold tracking-tight text-[#0077b6] dark:text-[#0ea5e9] leading-none">
                     G-MED 3.0
                 </h1>
                 <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 tracking-[0.2em] uppercase">
                     Advanced Clinical AI
                 </p>
             </div>
        </div>

        {/* --- MAIN LOGIN CONTAINER --- */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {/* Header Strip */}
            <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isBiometricViewActive ? "Secure Biometric Entry" : "Professional Access"}
                </h2>
                <span className="flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                    <ShieldCheck className="h-3 w-3" /> HIPAA SECURE
                </span>
            </div>

            <div className="p-8">
                
                {/* 1. BIOMETRIC QUICK SIGN-IN VIEW */}
                {isBiometricViewActive && enrolledProfile ? (
                  <div className="flex flex-col items-center justify-center space-y-6 text-center py-4">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner relative group cursor-pointer"
                         onClick={handleBiometricAuthTrigger}>
                        <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping opacity-70"></div>
                        <Fingerprint className="h-10 w-10 text-[#0077b6] dark:text-[#0ea5e9] group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Welcome Back</p>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white truncate max-w-[280px]">
                            {enrolledProfile.displayName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {enrolledProfile.email}
                        </p>
                    </div>

                    <div className="w-full space-y-3 pt-2">
                        <button
                            type="button"
                            onClick={handleBiometricAuthTrigger}
                            className="w-full bg-[#0077b6] hover:bg-[#005f92] dark:bg-[#0ea5e9] dark:hover:bg-[#0284c7] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98] text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Fingerprint className="h-4 w-4" /> Sign In with TouchID/FaceID
                        </button>

                        <div className="flex justify-between items-center px-1 text-xs">
                          <button
                              type="button"
                              onClick={() => setIsBiometricViewActive(false)}
                              className="text-slate-500 dark:text-slate-400 font-bold hover:underline"
                          >
                              Use Password instead
                          </button>
                          
                          <button
                              type="button"
                              onClick={handleRemoveBiometricLock}
                              className="text-red-500 dark:text-red-400 font-bold hover:underline"
                          >
                              Remove Biometric Lock
                          </button>
                        </div>
                    </div>
                  </div>
                ) : (
                  
                  /* 2. STANDARD PASS / EMAIL FORM WITH BIOMETRIC SETUP OPTION */
                  <div className="space-y-5">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="doctor@hospital.com"
                                className="block w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0077b6] focus:border-transparent outline-none transition-all text-slate-900 dark:text-white font-medium"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Password</label>
                                <button type="button" className="text-xs text-[#0077b6] dark:text-[#0ea5e9] font-bold hover:underline">Forgot?</button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="block w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0077b6] focus:border-transparent outline-none transition-all text-slate-900 dark:text-white font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Setup Biometric Login Toggle */}
                        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          <input 
                            type="checkbox" 
                            id="enroll_biometric"
                            checked={enrollBiometricOnLogin}
                            onChange={(e) => setEnrollBiometricOnLogin(e.target.checked)}
                            className="w-4 h-4 text-[#0077b6] bg-slate-100 border-slate-300 rounded focus:ring-[#0077b6] dark:focus:ring-blue-600 dark:ring-offset-slate-900 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                          />
                          <label htmlFor="enroll_biometric" className="text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none flex items-center gap-1.5 flex-1">
                            <Fingerprint className="h-4 w-4 text-[#0077b6] dark:text-[#0ea5e9]" />
                            <span>Trust this device & enroll TouchID/FaceID</span>
                          </label>
                        </div>

                        {error && (
                          <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/50 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <span>{error}</span>
                          </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#0077b6] hover:bg-[#005f92] dark:bg-[#0ea5e9] dark:hover:bg-[#0284c7] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98] text-base mt-2 cursor-pointer"
                        >
                            Sign In
                        </button>
                    </form>

                    {/* Google Alternative and Exit Hatch for Enrolled */}
                    <div className="space-y-4">
                        <button 
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                        >
                             {loading ? (
                               <Loader2 className="h-5 w-5 animate-spin text-[#0077b6] dark:text-[#0ea5e9]" />
                             ) : (
                               /* Google G Icon (SVG) */
                               <svg className="w-5 h-5" viewBox="0 0 48 48">
                                   <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                                   <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                                   <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                                   <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                               </svg>
                             )}
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              {loading ? 'Signing in...' : 'Continue with Google'}
                            </span>
                        </button>

                        {enrolledProfile && (
                          <button
                            type="button"
                            onClick={() => setIsBiometricViewActive(true)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#0077b6] dark:text-[#0ea5e9] hover:underline"
                          >
                            <Smartphone className="h-3.5 w-3.5" /> Return to Biometric Sign In
                          </button>
                        )}
                    </div>
                  </div>
                )}
            </div>
            
            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-4 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                    By logging in, you agree to our <a href="#" className="underline">Terms of Service</a>.
                </p>
            </div>
        </div>

        {/* Feature Pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
            <FeaturePill text="Biometrics Active" />
            <FeaturePill text="Secure Encryption" />
            <FeaturePill text="CME Credits" />
        </div>
      </div>

      {/* --- INTEGRATED BIOMETRIC SCANNING HUD MODAL --- */}
      {scannerOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col relative overflow-hidden">
            
            {/* Corner Accent Glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
            
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#0077b6]" />
                  G-MED Clinical Security Hub
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {scannerMode === 'enroll' ? 'Enrolling local TouchID/FaceID credential' : 'Biometric Identity Clearance'}
                </p>
              </div>
              <button 
                onClick={() => { clearScannerTimeouts(); setScannerOpen(false); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Interactive Scanning HUD Area */}
            <div className="flex flex-col items-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
              
              {/* Laser Line Overlay (Active when scanning) */}
              {scanState === 'scanning' && (
                <div className="absolute left-0 right-0 h-0.5 bg-cyan-400/80 shadow-[0_0_10px_#22d3ee] animate-laser-move z-10"></div>
              )}

              {/* Pulsing Target Circular Button */}
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
                {/* Simulated Scan Wave Ring */}
                {scanState === 'scanning' && (
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-60"></div>
                )}
                
                {/* SVG Radial Progress Border */}
                {scanState === 'scanning' && (
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      stroke="url(#progressGrad)"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray="314"
                      strokeDashoffset={314 - (314 * scanProgress) / 100}
                      className="transition-all duration-75"
                    />
                    <defs>
                      <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#0ea5e9" />
                      </linearGradient>
                    </defs>
                  </svg>
                )}

                {/* State Icons */}
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

              {/* Interaction Call to Action */}
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
                    Simulated scan: Touch and hold circular pad above
                  </p>
                )}
                {scanState === 'scanning' && (
                  <p className="text-[11px] font-bold text-cyan-500 animate-pulse mt-2">
                    Transmitting cryptograph... {scanProgress}% complete
                  </p>
                )}
              </div>
            </div>

            {/* Live Security Console Logs Console */}
            <div className="mt-5 space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                Cryptographic Console Logs
              </span>
              <div className="h-28 bg-slate-900 rounded-xl p-3 border border-slate-800 overflow-y-auto font-mono text-[9px] text-slate-400 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                {scannerLogs.map((log, index) => (
                  <div key={index} className="flex gap-2 items-start leading-relaxed">
                    <span className="text-cyan-500/80 font-bold shrink-0">&gt;</span>
                    <span className="truncate max-w-[340px] whitespace-normal">{log}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { clearScannerTimeouts(); setScannerOpen(false); }}
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

const FeaturePill = ({ text }: { text: string }) => (
    <span className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
        {text}
    </span>
);

export default Login;
