import React, { useEffect, useState } from 'react';
import { NewsArticle } from '../types';
import { fetchMedicalNews } from '../services/geminiService';
import { Bookmark, Share2, Upload, Activity } from 'lucide-react';

const NewsFeed: React.FC = () => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      setLoading(true);
      const articles = await fetchMedicalNews();
      setNews(articles);
      setLoading(false);
    };
    loadNews();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
             <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
             <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
             <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  // Helper to get a placeholder image based on category
  const getPlaceholderImage = (category: string, index: number) => {
      const colors = [
          'from-blue-700 to-indigo-900',
          'from-emerald-700 to-teal-900',
          'from-purple-700 to-fuchsia-900',
          'from-rose-700 to-red-900'
      ];
      const color = colors[index % colors.length];
      
      return (
          <div className={`w-full h-48 md:h-64 bg-gradient-to-br ${color} flex items-center justify-center text-white relative overflow-hidden shadow-sm`}>
               <div className="absolute inset-0 bg-black/20 mix-blend-multiply"></div>
               {/* Abstract pattern lines */}
               <div className="absolute inset-0 opacity-30" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px'}}></div>
               <span className="relative z-10 font-bold text-2xl opacity-90 drop-shadow-md">{category}</span>
          </div>
      );
  };

  return (
    <div className="bg-white dark:bg-slate-950 font-sans transition-colors duration-300">
      
      {/* BRANDED HEADER for News Feed */}
      <div className="px-4 py-4 flex items-center space-x-2.5 border-b border-slate-50 dark:border-slate-900/50 mb-1">
          <div className="w-6 h-6 bg-gradient-to-br from-[#0077b6] to-[#005f92] rounded flex items-center justify-center shadow-sm">
             <Activity className="h-3.5 w-3.5 text-white" strokeWidth={3} />
          </div>
          <h1 className="text-sm font-extrabold text-slate-800 dark:text-white tracking-tight">
             <span className="text-[#0077b6] dark:text-[#0ea5e9]">G-MED 3.0</span> Medical News
          </h1>
      </div>
      
      {news.map((article, index) => (
        <div key={index} className="bg-white dark:bg-slate-950 pb-8 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors duration-300">
          <div className="px-4 mt-2">
            {/* Headline */}
            <h2 className="text-[1.2rem] leading-snug font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-tight">
                {article.title}
            </h2>

            {/* Summary */}
            <p className="text-slate-600 dark:text-slate-400 text-[0.95rem] leading-relaxed mb-4 line-clamp-3">
                {article.summary}
            </p>
          </div>

          {/* Image Area (Full width mobile style) */}
          <div className="mb-3">
              {getPlaceholderImage(article.category, index)}
          </div>

          {/* Footer Metadata */}
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-500 font-medium px-4">
             <div className="text-slate-400">
                {article.timestamp}
             </div>
             
             <div className="flex space-x-6">
                <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                    <Bookmark className="h-5 w-5" />
                </button>
                <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                    <Upload className="h-5 w-5" />
                </button>
             </div>
          </div>
          
          {/* Source attribution line */}
          <div className="px-4 mt-3 pt-3 border-t border-slate-50 dark:border-slate-900">
             <span className="text-xs font-bold text-slate-900 dark:text-slate-300">{article.source}</span>
          </div>

        </div>
      ))}
    </div>
  );
};

export default NewsFeed;