
import React, { useState, useEffect } from 'react';
import { MessageSquare, Radio, Eye, Palette, Music, ShieldCheck, Lock, Grid, Settings, Server, Cloud, ChevronUp, ChevronDown, Cpu, Network, Info, RefreshCw } from 'lucide-react';
import { AppTab } from '../types';
import { getOllamaModels } from '../services/geminiService';

interface SidebarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  provider: 'GEMINI' | 'OLLAMA';
  onProviderChange: (provider: 'GEMINI' | 'OLLAMA', model?: string, url?: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, provider, onProviderChange }) => {
  const [showSettings, setShowSettings] = useState(false);
  
  // Local state for inputs
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  
  // Model fetching state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    const savedModel = localStorage.getItem('ollama_model');
    const savedUrl = localStorage.getItem('ollama_url');
    if (savedModel) setOllamaModel(savedModel);
    if (savedUrl) setOllamaUrl(savedUrl);
  }, []);

  // Fetch models whenever provider is OLLAMA or URL changes (debounced usually, but simple here)
  useEffect(() => {
    if (provider === 'OLLAMA' && showSettings) {
      fetchModels();
    }
  }, [provider, showSettings]);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const models = await getOllamaModels(ollamaUrl);
      if (models.length > 0) {
        setAvailableModels(models);
        // If current model not in list, pick first
        if (!models.includes(ollamaModel) && models[0]) {
             handleConfigChange('model', models[0]);
        }
      }
    } catch (e) {
      console.error("Could not fetch models", e);
    } finally {
      setLoadingModels(false);
    }
  };

  const navItems = [
    { id: AppTab.CHAT, icon: MessageSquare, label: 'Lyrics & Chat' },
    { id: AppTab.LIVE, icon: Radio, label: 'Jam Session' },
    { id: AppTab.VISION, icon: Eye, label: 'Vision' },
    { id: AppTab.STUDIO, icon: Palette, label: 'Album Art' },
    { id: AppTab.MUSIC_HUB, icon: Grid, label: 'Music Hub' },
  ];

  const handleProviderSwitch = (newProvider: 'GEMINI' | 'OLLAMA') => {
    // Save provider and current config
    onProviderChange(newProvider, ollamaModel, ollamaUrl);
  };

  const handleConfigChange = (key: 'model' | 'url', value: string) => {
    if (key === 'model') {
      setOllamaModel(value);
      localStorage.setItem('ollama_model', value);
      // Only update live provider if currently set to OLLAMA
      if (provider === 'OLLAMA') onProviderChange('OLLAMA', value, ollamaUrl);
    } else {
      setOllamaUrl(value);
      localStorage.setItem('ollama_url', value);
      if (provider === 'OLLAMA') onProviderChange('OLLAMA', ollamaModel, value);
    }
  };

  return (
    <div className="w-20 md:w-72 h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 transition-all duration-300 z-50 shadow-2xl">
      {/* Branding */}
      <div className="h-20 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800 relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-indigo-500/5 blur-xl"></div>
        <Music className="text-indigo-500 w-8 h-8 relative z-10 flex-shrink-0" />
        <span className="hidden md:block ml-3 text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-emerald-400 relative z-10 whitespace-nowrap">
          Project Harmony
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center justify-center md:justify-start p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
              currentTab === item.id 
                ? 'bg-indigo-600/10 text-indigo-400' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 ${currentTab === item.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
            <span className={`hidden md:block ml-3 font-medium text-sm ${currentTab === item.id ? 'font-semibold' : ''}`}>
              {item.label}
            </span>
            {currentTab === item.id && (
              <div className="hidden md:block ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
            )}
          </button>
        ))}
      </nav>

      {/* Footer / Settings */}
      <div className="p-4 border-t border-slate-800 space-y-4 bg-slate-900">
         
         {/* Settings Toggle */}
         <div className="hidden md:block">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center justify-between w-full p-2 rounded-lg text-xs font-medium transition-colors ${
                showSettings ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-2 uppercase tracking-wider">
                <Settings size={14} /> AI Provider Settings
              </span>
              {showSettings ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            
            {showSettings && (
               <div className="mt-3 bg-slate-800/50 rounded-xl p-3 space-y-4 border border-slate-700/50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  
                  {/* Provider Switch */}
                  <div className="bg-slate-900 p-1 rounded-lg flex relative">
                     <button
                        onClick={() => handleProviderSwitch('GEMINI')}
                        className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-bold py-2 rounded-md transition-all z-10 ${
                           provider === 'GEMINI' 
                           ? 'bg-emerald-600 text-white shadow-lg' 
                           : 'text-slate-500 hover:text-slate-300'
                        }`}
                     >
                        <Cloud size={12} /> CLOUD
                     </button>
                     <button
                        onClick={() => handleProviderSwitch('OLLAMA')}
                        className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-bold py-2 rounded-md transition-all z-10 ${
                           provider === 'OLLAMA' 
                           ? 'bg-indigo-600 text-white shadow-lg' 
                           : 'text-slate-500 hover:text-slate-300'
                        }`}
                     >
                        <Server size={12} /> LOCAL
                     </button>
                  </div>

                  {/* Settings Content */}
                  {provider === 'OLLAMA' ? (
                     <div className="space-y-3">
                        <div className="space-y-1.5">
                           <div className="flex justify-between items-center">
                              <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 cursor-help group relative">
                                  <Cpu size={10} /> Model
                                  <Info size={10} className="text-slate-500" />
                                  <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-950 border border-slate-700 rounded-lg text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Select the Ollama model to use (e.g., llama3, mistral). Ensure it is pulled via `ollama pull [model]`.
                                  </div>
                              </label>
                              <button 
                                onClick={fetchModels} 
                                disabled={loadingModels}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                              >
                                {loadingModels ? <RefreshCw size={10} className="animate-spin"/> : <RefreshCw size={10}/>}
                              </button>
                           </div>
                           
                           {availableModels.length > 0 ? (
                             <select 
                               value={ollamaModel}
                               onChange={(e) => handleConfigChange('model', e.target.value)}
                               className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                             >
                                {availableModels.map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                             </select>
                           ) : (
                              <input 
                                type="text" 
                                value={ollamaModel}
                                onChange={(e) => handleConfigChange('model', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600"
                                placeholder="e.g. llama3"
                              />
                           )}
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 cursor-help group relative">
                              <Network size={10} /> Base URL
                              <Info size={10} className="text-slate-500" />
                              <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-950 border border-slate-700 rounded-lg text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                The address of your Ollama server. Default is http://localhost:11434. Requires `OLLAMA_ORIGINS="*"` environment variable on server.
                              </div>
                           </label>
                           <div className="flex gap-1">
                              <input 
                                type="text" 
                                value={ollamaUrl}
                                onChange={(e) => handleConfigChange('url', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600"
                                placeholder="http://localhost:11434"
                              />
                           </div>
                        </div>
                     </div>
                  ) : (
                    <div className="text-center py-2 space-y-1">
                        <p className="text-[10px] text-emerald-400 font-medium flex items-center justify-center gap-1">
                            <ShieldCheck size={10} /> Google Gemini Active
                        </p>
                        <p className="text-[9px] text-slate-500">
                            Using high-performance cloud inference.
                        </p>
                    </div>
                  )}
               </div>
            )}
         </div>

         {/* Security Badge (Always visible on desktop) */}
         <div className="hidden md:block p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/80 transition-all group cursor-help">
           <div className="flex items-center justify-between mb-1">
             <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                 provider === 'GEMINI' ? 'text-emerald-500' : 'text-indigo-500'
             }`}>
               <Lock size={10} />
               {provider === 'GEMINI' ? 'Cloud Secure' : 'Local Secure'}
             </p>
             <div className={`w-1.5 h-1.5 rounded-full ${
                 provider === 'GEMINI' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]'
             }`} />
           </div>
           <p className="text-[9px] text-slate-500 leading-tight">
             {provider === 'GEMINI' 
                ? 'Traffic encrypted via TLS 1.3' 
                : `Connected to ${ollamaUrl.replace('http://', '')}`
             }
           </p>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;
