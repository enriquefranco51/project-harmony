
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import LiveInterface from './components/LiveInterface';
import VisionInterface from './components/VisionInterface';
import StudioInterface from './components/StudioInterface';
import MusicHubInterface from './components/MusicHubInterface';
import { AppTab } from './types';
import { setProviderConfig, AIProvider } from './services/geminiService';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.LIVE);
  const [provider, setProvider] = useState<AIProvider>('GEMINI');

  useEffect(() => {
    // Load persisted provider settings
    const savedProvider = localStorage.getItem('ai_provider') as AIProvider;
    const savedModel = localStorage.getItem('ollama_model') || 'llama3';
    const savedUrl = localStorage.getItem('ollama_url') || 'http://localhost:11434';

    if (savedProvider) {
      setProvider(savedProvider);
      // Initialize service with saved config
      setProviderConfig(savedProvider, savedModel, savedUrl);
    }
  }, []);

  const handleProviderChange = (newProvider: AIProvider, model?: string, url?: string) => {
    setProvider(newProvider);
    localStorage.setItem('ai_provider', newProvider);
    setProviderConfig(newProvider, model, url);
  };

  const renderContent = () => {
    switch (currentTab) {
      case AppTab.CHAT:
        return <ChatInterface />;
      case AppTab.LIVE:
        return <LiveInterface />;
      case AppTab.VISION:
        return <VisionInterface />;
      case AppTab.STUDIO:
        return <StudioInterface />;
      case AppTab.MUSIC_HUB:
        return <MusicHubInterface />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden text-slate-100 font-sans selection:bg-indigo-500/30">
      <Sidebar 
        currentTab={currentTab} 
        onTabChange={setCurrentTab} 
        provider={provider}
        onProviderChange={handleProviderChange}
      />
      
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Top Header / Status Bar (Mobile mostly) */}
        <header className="h-14 border-b border-slate-800/50 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm md:hidden">
          <span className="font-semibold text-slate-200">{currentTab}</span>
        </header>

        <div className="flex-1 relative">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
