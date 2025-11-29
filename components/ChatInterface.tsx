
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, ShieldCheck, Lock, Brain, Sparkles, Trash2, Calendar, Database, Mic, MicOff, Music } from 'lucide-react';
import { ChatMessage, Sender, MemoryContext } from '../types';
import { streamChat } from '../services/geminiService';
import { redactPII, getPersistentKey } from '../services/securityUtils';
import { vectorDb } from '../services/vectorDbService';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      text: "Welcome to Project Harmony. I am your AI Music Producer. We can write lyrics, explore music theory, or brainstorm your next full-length album. My long-term memory is encrypted and stored locally.",
      sender: Sender.MODEL,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSecure, setIsSecure] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Security Context
  useEffect(() => {
    const initSecurity = async () => {
      await getPersistentKey();
      setIsSecure(true);
    };
    initSecurity();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleClearMemory = async () => {
      if (window.confirm("Are you sure you want to purge all creative memories? This cannot be undone.")) {
          await vectorDb.clear();
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              text: "System: Creative vector memory has been purged.",
              sender: Sender.MODEL,
              timestamp: new Date()
          }]);
      }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => (prev ? prev + ' ' : '') + transcript);
      };
      
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Redact PII
    const cleanInput = redactPII(input);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Retrieve Context from Vector DB (RAG)
      let contextDocs: MemoryContext[] = [];
      try {
         // Increase threshold or logic if needed, here we just get top 3
         contextDocs = await vectorDb.search(cleanInput, 3);
         // Filter out low relevance if desired, e.g., score < 0.6
         contextDocs = contextDocs.filter(doc => doc.score > 0.65);
      } catch (e) {
         console.error("Vector Search failed", e);
      }
      
      // Format context for LLM with timestamps
      const contextString = contextDocs.length > 0 
        ? `\n\n[System Context - Relevant Creative Memories]:\n${contextDocs.map(d => `- [Date: ${new Date(d.timestamp).toLocaleDateString()}] ${d.text}`).join('\n')}`
        : '';
      
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        text: cleanInput,
        sender: Sender.USER,
        timestamp: new Date(),
        contextUsed: contextDocs.length > 0 ? contextDocs : undefined
      };
      
      setMessages(prev => [...prev, userMsg]);

      // 2. Prepare History with Context Injection
      const history = messages.map(m => ({
        role: m.sender === Sender.USER ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      
      // Inject context into the user's message payload for the model (invisible to user UI usually, but here we append contextString effectively)
      // Note: We don't show the contextString in the UI bubble for the user msg, but we send it to LLM
      const promptWithContext = cleanInput + contextString;

      let fullResponse = '';
      const responseId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, {
        id: responseId,
        text: '',
        sender: Sender.MODEL,
        timestamp: new Date()
      }]);

      await streamChat(history, promptWithContext, (chunk) => {
        fullResponse += chunk;
        setMessages(prev => prev.map(m => 
          m.id === responseId ? { ...m, text: fullResponse } : m
        ));
      });

      // 3. Store interaction in Vector DB for future memory
      Promise.all([
          vectorDb.addDocument(cleanInput, 'chat'),
          vectorDb.addDocument(fullResponse, 'chat')
      ]).then(() => console.debug("Memory updated"));

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "I encountered an error processing your request securely.",
        sender: Sender.MODEL,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Security Banner */}
      <div className="bg-slate-800/50 border-b border-slate-700/50 px-4 py-2 flex items-center justify-between">
         <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium uppercase tracking-wider">
            <ShieldCheck size={14} />
            <span>Encrypted Studio Session</span>
         </div>
         {isSecure && (
             <div className="flex items-center gap-3">
                 <button 
                    onClick={handleClearMemory}
                    className="flex items-center gap-1 text-red-400 text-[10px] font-mono bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 hover:bg-red-500/20 transition-colors"
                 >
                    <Trash2 size={10} />
                    <span>Purge Memory</span>
                 </button>
                 <div className="flex items-center gap-1 text-indigo-400 text-[10px] font-mono bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    <Brain size={10} />
                    <span>Vector Memory Active</span>
                 </div>
                 <div className="flex items-center gap-1 text-slate-500 text-[10px] font-mono">
                    <Lock size={10} />
                    <span>AES-256-GCM + IDB</span>
                 </div>
             </div>
         )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === Sender.USER ? 'flex-row-reverse' : ''
            }`}
          >
            <div className={`p-2 rounded-full flex-shrink-0 ${
              msg.sender === Sender.USER ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}>
              {msg.sender === Sender.USER ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className="flex flex-col gap-1 max-w-[85%] md:max-w-[75%]">
                <div className={`rounded-2xl p-4 shadow-sm ${
                msg.sender === Sender.USER 
                    ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/30' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                }`}>
                <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{msg.text}</p>
                {msg.sender === Sender.USER && msg.text !== input && input.length > 0 && (
                    <span className="text-[10px] text-indigo-300/50 mt-2 block flex items-center gap-1">
                        <ShieldCheck size={10} /> PII Scrubbed
                    </span>
                )}
                </div>
                
                {/* Memory Context Visualization */}
                {msg.contextUsed && msg.contextUsed.length > 0 && (
                  <div className="self-end mt-2 bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 w-full max-w-sm">
                      <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2 font-medium">
                        <Database size={12} />
                        <span>Recalled {msg.contextUsed.length} Creative Memories</span>
                      </div>
                      <div className="space-y-2">
                        {msg.contextUsed.map((ctx, idx) => (
                          <div key={idx} className="bg-slate-900/50 border-l-2 border-indigo-500/50 pl-2 py-1">
                             <div className="flex justify-between items-center text-[10px] text-slate-500 mb-0.5">
                                <span className="flex items-center gap-1"><Calendar size={8} /> {new Date(ctx.timestamp).toLocaleDateString()}</span>
                                <span className="text-indigo-400/70">{Math.round(ctx.score * 100)}% match</span>
                             </div>
                             <p className="text-[11px] text-slate-400 line-clamp-2 italic">"{ctx.text}"</p>
                          </div>
                        ))}
                      </div>
                  </div>
                )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <div className="max-w-4xl mx-auto relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Write lyrics, ask about chord progressions..."
            className="w-full bg-slate-800 border-slate-700 text-slate-200 rounded-xl pl-4 pr-24 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder-slate-500"
            disabled={isLoading}
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              onClick={toggleListening}
              className={`p-2 rounded-lg transition-colors ${
                isListening 
                  ? 'text-red-400 bg-red-400/10 animate-pulse' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
              title="Voice Input"
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-900/20"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-slate-600 mt-2 flex justify-center gap-4">
           <span className="flex items-center gap-1"><Lock size={8} /> Local Encryption</span>
           <span className="flex items-center gap-1"><Brain size={8} /> Semantic Memory</span>
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
