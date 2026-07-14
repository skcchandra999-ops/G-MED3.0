import React, { Component, useState, useEffect, ReactNode, ErrorInfo } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import NewsFeed from './components/NewsFeed';
import DrugInteractionChecker from './components/DrugInteractionChecker';
import ClinicalAssistant from './components/ClinicalAssistant';
import ClinicalScores from './components/ClinicalScores';
import Bundles from './components/Bundles';
import Procedures from './components/Procedures';
import Calculators from './components/Calculators';
import MiniEMR from './components/MiniEMR';
import { AppView } from './types';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, testConnection } from './services/firebase';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Error Boundary Component
// Explicitly use the Component generic types and class properties to resolve type recognition issues.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Explicitly declare state as a class property for the TypeScript compiler.
  public state: ErrorBoundaryState = { hasError: false };
  // Fix: Explicitly declare props to satisfy the compiler when property lookup fails on instance.
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    // Explicitly assign props to this instance.
    this.props = props;
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    // Fix: Access hasError property correctly from this.state.
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-sm">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
                <p className="text-slate-500 text-sm mb-6">The application encountered an unexpected error. Please try reloading.</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
                >
                    Reload App
                </button>
            </div>
        </div>
      );
    }
    
    // Fix: Access children correctly from this.props.
    return this.props.children || null;
  }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  // Navigation History Stack
  const [history, setHistory] = useState<AppView[]>([AppView.NEWS]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [initialAiQuery, setInitialAiQuery] = useState('');

  // Firebase connection and auth state sync
  useEffect(() => {
    testConnection();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const currentView = history[history.length - 1];
  const canGoBack = history.length > 1;

  // Apply dark class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error", err);
    }
    setIsAuthenticated(false);
    setHistory([AppView.NEWS]);
  };

  const handleNavigate = (view: AppView) => {
    // If clicking the current view, do nothing
    if (view === currentView) return;
    
    // Push to history
    setHistory(prev => [...prev, view]);
  };

  const handleBack = () => {
    if (history.length > 1) {
        setHistory(prev => prev.slice(0, -1));
    }
  };

  const handleSearch = (query: string) => {
    setInitialAiQuery(query);
    if (currentView !== AppView.CLINICAL_ASSISTANT) {
        setHistory(prev => [...prev, AppView.CLINICAL_ASSISTANT]);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case AppView.NEWS:
        return <NewsFeed />;
      case AppView.SCORES:
        return <ClinicalScores />;
      case AppView.BUNDLES:
        return <Bundles />;
      case AppView.PROCEDURES:
        return <Procedures />;
      case AppView.DRUGS:
        return <DrugInteractionChecker />;
      case AppView.CALCULATORS:
        return <Calculators />;
      case AppView.EMR:
        return <MiniEMR />;
      case AppView.CLINICAL_ASSISTANT:
        return <ClinicalAssistant initialQuery={initialAiQuery} onClearQuery={() => setInitialAiQuery('')} />;
      default:
        return <NewsFeed />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-cyan-400">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-cyan-500" />
          <p className="font-mono text-xs uppercase tracking-widest font-black">Authenticating Clinician...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {isAuthenticated ? (
        <Layout 
            currentView={currentView} 
            onNavigate={handleNavigate} 
            onLogout={handleLogout}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
            onSearch={handleSearch}
            canGoBack={canGoBack}
            onBack={handleBack}
        >
          {renderContent()}
        </Layout>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </ErrorBoundary>
  );
}

export default App;
