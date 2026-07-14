import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle, Activity, Loader2 } from 'lucide-react';
import { signInWithGoogle } from '../services/firebase';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // Pre-filled state allows instant login
  const [email, setEmail] = useState('doctor@hospital.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onLogin();
    } catch (err: any) {
      console.error("Google sign in error", err);
      setError(err?.message || "Google Sign-In failed. Please try again.");
    } finally {
      setLoading(false);
    }
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {/* Header Strip */}
            <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                    Professional Access
                </h2>
            </div>

            <div className="p-8">
                {/* Email/Pass Form */}
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

                    {error && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/50">
                        {error}
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

                <div className="mt-8 text-center">
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
                </div>
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
            <FeaturePill text="Offline Mode" />
            <FeaturePill text="Secure Encryption" />
            <FeaturePill text="CME Credits" />
        </div>
      </div>
    </div>
  );
};

const FeaturePill = ({ text }: { text: string }) => (
    <span className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
        {text}
    </span>
);

export default Login;