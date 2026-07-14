import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { sendClinicalMessage } from '../services/geminiService';
import { Send, User, Bot, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GenerateContentResponse } from "@google/genai";

interface ClinicalAssistantProps {
    initialQuery?: string;
    onClearQuery?: () => void;
}

const ClinicalAssistant: React.FC<ClinicalAssistantProps> = ({ initialQuery, onClearQuery }) => {
  const [messages, setMessages] = useState<(ChatMessage & { groundingSources?: {uri: string, title?: string}[] })[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello, Dr. I am G-MED 3.0 Assistant. I can help with clinical queries, differential diagnoses, or guideline lookups. How can I assist you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle initial query from search bar
  useEffect(() => {
      if (initialQuery) {
          handleSend(initialQuery);
          if (onClearQuery) onClearQuery();
      }
  }, [initialQuery]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
        // Convert internal message format to Gemini history format
        const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const streamResult = await sendClinicalMessage(history, userMsg.text);
        
        // Placeholder message for streaming
        const botMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, {
            id: botMsgId,
            role: 'model',
            text: '',
            timestamp: new Date(),
            groundingSources: []
        }]);

        let fullText = '';
        let allSources: {uri: string, title?: string}[] = [];

        for await (const chunk of streamResult) {
            const c = chunk as GenerateContentResponse;
            const chunkText = c.text || '';
            fullText += chunkText;
            
            // Fix: Extract grounding metadata to satisfy the Google Search grounding requirements.
            const groundingChunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                groundingChunks.forEach(chunk => {
                    if (chunk.web && chunk.web.uri) {
                        if (!allSources.some(s => s.uri === chunk.web?.uri)) {
                            allSources.push({
                                uri: chunk.web.uri,
                                title: chunk.web.title
                            });
                        }
                    }
                });
            }
            
            setMessages(prev => prev.map(msg => 
                msg.id === botMsgId 
                ? { ...msg, text: fullText, groundingSources: allSources.length > 0 ? allSources : msg.groundingSources } 
                : msg
            ));
        }

    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
         <div className="flex items-center space-x-3">
            <div className="bg-med-100 p-2 rounded-lg">
                <Bot className="h-6 w-6 text-med-600" />
            </div>
            <div>
                <h2 className="font-bold text-slate-900">Clinical Assistant</h2>
                <p className="text-xs text-slate-500 flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    Online • AI-Powered (Gemini)
                </p>
            </div>
         </div>
         <div className="text-xs text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
            For informational purposes only
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`
                flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1
                ${msg.role === 'user' ? 'bg-med-600 ml-3' : 'bg-indigo-600 mr-3'}
              `}>
                {msg.role === 'user' ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
              </div>
              
              <div className={`
                p-4 rounded-2xl text-sm leading-relaxed shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-med-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'}
                ${msg.isError ? 'border-red-300 bg-red-50 text-red-800' : ''}
              `}>
                {msg.role === 'model' ? (
                    <div className="prose prose-sm max-w-none prose-slate">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                        
                        {/* Fix: List grounding website URLs as links when Google Search tool is used. */}
                        {msg.groundingSources && msg.groundingSources.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sources from Google Search:</p>
                                <div className="flex flex-col gap-1.5">
                                    {msg.groundingSources.map((source, idx) => (
                                        <a 
                                            key={idx}
                                            href={source.uri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center space-x-2 text-xs text-[#0077b6] hover:underline"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            <span className="truncate">{source.title || source.uri}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    msg.text
                )}
                <div className={`text-[10px] mt-2 opacity-70 ${msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          </div>
        ))}
        {loading && (
             <div className="flex justify-start">
                 <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm ml-11 flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-med-600" />
                    <span className="text-sm text-slate-500">Thinking...</span>
                 </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        {/* Warning Banner */}
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded mb-3 border border-amber-100">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>Verify all AI-generated information with standard clinical guidelines. Do not use for emergency decisions.</p>
        </div>
        
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a clinical question (e.g., 'First-line treatment for CAP in adults?')"
            className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-med-500 focus:border-med-500 outline-none text-sm"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="bg-med-600 text-white p-3 rounded-lg hover:bg-med-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicalAssistant;