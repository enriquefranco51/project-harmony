
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Eye, Hand, Type, Palette, MousePointer2, 
  Play, Square, Save, MapPin, Activity, 
  Volume2, Settings, Download, Music
} from 'lucide-react';
import { browserService, GeoContext } from '../services/browserService';

// Musical Constants
const SCALES = {
  chromatic: [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88],
  pentatonic: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25] // C Major Pentatonic
};

interface Composition {
  id: number;
  name: string;
  pattern: boolean[];
  timestamp: number;
}

const MusicHubInterface: React.FC = () => {
  // --- State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [volume, setVolume] = useState(70);
  const [instrument, setInstrument] = useState<'sine' | 'square' | 'sawtooth'>('sine');
  const [sequencerGrid, setSequencerGrid] = useState<boolean[]>(new Array(16).fill(false));
  const [currentStep, setCurrentStep] = useState(0);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [geoContext, setGeoContext] = useState<GeoContext | null>(null);

  // --- Accessibility State ---
  const [highContrast, setHighContrast] = useState(false);
  const [voiceControl, setVoiceControl] = useState(false);
  const [eyeTracking, setEyeTracking] = useState(false); // Simulated
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // --- Refs ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const schedulerRef = useRef<number>(0);
  const nextNoteTimeRef = useRef<number>(0);
  
  // --- Initialization ---
  useEffect(() => {
    // Load Local Compositions
    const saved = browserService.loadLocal<Composition[]>('harmony_compositions');
    if (saved) setCompositions(saved);

    // Get Geolocation
    browserService.getGeolocation()
      .then(setGeoContext)
      .catch(err => console.debug("Geo access denied/failed", err));

    // Audio Context Init (lazy)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AudioContextClass();

    return () => {
      cancelAnimationFrame(animationRef.current);
      clearInterval(schedulerRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // --- Visualizer Loop ---
  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear
      ctx.fillStyle = highContrast ? '#000000' : '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Wave/Visual
      const time = Date.now() / 1000;
      ctx.beginPath();
      ctx.lineWidth = highContrast ? 4 : 2;
      ctx.strokeStyle = highContrast ? '#FFFF00' : '#10b981'; // Yellow or Emerald
      
      const centerY = canvas.height / 2;
      for (let x = 0; x < canvas.width; x++) {
        // Visualize "Audio" (simulated based on sequencer state if playing)
        let amplitude = 0;
        if (isPlaying && sequencerGrid[currentStep]) {
            amplitude = 50 * Math.sin(x * 0.1 + time * 20);
        } else {
            amplitude = 10 * Math.sin(x * 0.05 + time * 5);
        }
        
        ctx.lineTo(x, centerY + amplitude);
      }
      ctx.stroke();

      // Eye Tracking Cursor Simulation
      if (eyeTracking) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.arc(mousePos.x - canvas.offsetLeft, mousePos.y - canvas.offsetTop, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };
    draw();
  }, [isPlaying, currentStep, highContrast, eyeTracking, mousePos, sequencerGrid]);

  // --- Mouse Tracker for Eye Tracking Sim ---
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
        if (eyeTracking) setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [eyeTracking]);

  // --- Audio Engine ---
  const playTone = (freq: number, duration: number) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = instrument;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(volume / 100 * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  // --- Sequencer Logic ---
  useEffect(() => {
    if (isPlaying) {
      const lookahead = 25.0; // ms
      const scheduleAheadTime = 0.1; // s

      const nextNote = () => {
        const secondsPerBeat = 60.0 / tempo;
        nextNoteTimeRef.current += secondsPerBeat * 0.25; // 16th notes
        setCurrentStep(prev => (prev + 1) % 16);
      };

      const scheduler = () => {
        if (!audioCtxRef.current) return;
        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + scheduleAheadTime) {
            // Schedule sound
            // We use state inside the interval, which might be stale in a standard setInterval
            // In a real app we'd use a ref for the grid, but for this demo we'll trigger audio in the render effect
            // or simplify: Just rely on UI update to trigger sound (less precise but works for UI demo)
            nextNote();
        }
      };

      // Reset
      if (audioCtxRef.current) nextNoteTimeRef.current = audioCtxRef.current.currentTime;
      schedulerRef.current = window.setInterval(scheduler, lookahead);
    } else {
      clearInterval(schedulerRef.current);
    }
  }, [isPlaying, tempo]);

  // Trigger Sound on Step Change if Active
  useEffect(() => {
    if (isPlaying && sequencerGrid[currentStep]) {
        // Pentatonic scale based on step index just for variation
        const note = SCALES.pentatonic[currentStep % SCALES.pentatonic.length];
        playTone(note, 0.2);
    }
  }, [currentStep, isPlaying]);

  // --- Handlers ---
  const toggleStep = (idx: number) => {
    const newGrid = [...sequencerGrid];
    newGrid[idx] = !newGrid[idx];
    setSequencerGrid(newGrid);
    if (newGrid[idx]) playTone(440, 0.1); // Feedback beep
  };

  const handleSave = async () => {
    const name = `Composition ${new Date().toLocaleTimeString()}`;
    const newComp: Composition = {
        id: Date.now(),
        name,
        pattern: sequencerGrid,
        timestamp: Date.now()
    };
    
    // Save to State & LocalStorage
    const updated = [newComp, ...compositions];
    setCompositions(updated);
    browserService.saveLocal('harmony_compositions', updated);

    // Prompt for File System Save
    await browserService.saveToFile(newComp, `harmony-project-${Date.now()}.json`);
  };

  const loadComp = (comp: Composition) => {
      setSequencerGrid(comp.pattern);
  };

  // --- Voice Control Mock ---
  // In a real app, this would use SpeechRecognition API
  useEffect(() => {
      if (voiceControl) {
          // Mock listener
          const handleKey = (e: KeyboardEvent) => {
              if (e.code === 'Space') {
                  setIsPlaying(prev => !prev);
              }
          };
          window.addEventListener('keydown', handleKey);
          return () => window.removeEventListener('keydown', handleKey);
      }
  }, [voiceControl]);

  return (
    <div className={`h-full flex flex-col ${highContrast ? 'bg-black text-yellow-400' : 'bg-slate-900 text-slate-100'}`}>
      
      {/* 1. Accessibility Control Bar */}
      <div className={`flex flex-wrap items-center gap-2 p-4 border-b ${highContrast ? 'border-yellow-400 bg-black' : 'border-slate-800 bg-slate-800/50'}`}>
         <div className="flex items-center gap-2 mr-4">
            <Activity className={highContrast ? 'text-yellow-400' : 'text-indigo-400'} size={20} />
            <span className="font-bold hidden md:inline">Accessibility Tools</span>
         </div>
         
         <button 
           onClick={() => setVoiceControl(!voiceControl)}
           className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
             voiceControl ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600'
           }`}
         >
            <Mic size={14} /> Voice {voiceControl ? 'On' : 'Off'}
         </button>

         <button 
           onClick={() => setEyeTracking(!eyeTracking)}
           className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
             eyeTracking ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
           }`}
         >
            <Eye size={14} /> Eye Tracking {eyeTracking ? 'On' : 'Off'}
         </button>

         <button 
           onClick={() => setHighContrast(!highContrast)}
           className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
             highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-slate-700 hover:bg-slate-600'
           }`}
         >
            <Palette size={14} /> High Contrast
         </button>
         
         {geoContext && (
             <div className="ml-auto hidden lg:flex items-center gap-2 text-xs opacity-60">
                 <MapPin size={12} />
                 <span>{geoContext.timezone}</span>
             </div>
         )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
         
         {/* 2. Tool Panel */}
         <div className={`w-full lg:w-80 p-6 flex flex-col gap-6 overflow-y-auto ${highContrast ? 'border-r border-yellow-400' : 'border-r border-slate-800 bg-slate-900'}`}>
            
            <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                    <Settings size={18} /> Studio Settings
                </h3>
                
                <div className="space-y-2">
                    <label className="text-xs uppercase font-bold opacity-70">Instrument</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['sine', 'square', 'sawtooth'].map(inst => (
                            <button
                                key={inst}
                                onClick={() => setInstrument(inst as any)}
                                className={`px-2 py-2 text-xs rounded border capitalize ${
                                    instrument === inst 
                                    ? (highContrast ? 'bg-yellow-400 text-black' : 'bg-indigo-600 border-indigo-500 text-white')
                                    : 'border-slate-700 hover:bg-slate-800'
                                }`}
                            >
                                {inst}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs uppercase font-bold opacity-70 flex justify-between">
                        Tempo <span>{tempo} BPM</span>
                    </label>
                    <input 
                        type="range" min="60" max="200" value={tempo} 
                        onChange={(e) => setTempo(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs uppercase font-bold opacity-70 flex justify-between">
                        Volume <span>{volume}%</span>
                    </label>
                    <input 
                        type="range" min="0" max="100" value={volume} 
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        isPlaying 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : (highContrast ? 'bg-white text-black' : 'bg-emerald-600 hover:bg-emerald-500 text-white')
                    }`}
                >
                    {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                    {isPlaying ? 'STOP' : 'PLAY'}
                </button>
                <button 
                    onClick={handleSave}
                    className={`p-3 rounded-xl flex items-center justify-center transition-all ${
                        highContrast ? 'border-2 border-yellow-400 text-yellow-400' : 'bg-slate-800 hover:bg-slate-700 text-indigo-400'
                    }`}
                    title="Save to Disk"
                >
                    <Save size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[200px]">
                <h4 className="text-xs uppercase font-bold opacity-70 mb-3 flex items-center gap-2">
                    <Download size={12} /> Local Saves
                </h4>
                <div className="space-y-2">
                    {compositions.map(comp => (
                        <div 
                            key={comp.id}
                            onClick={() => loadComp(comp)}
                            className={`p-3 rounded-lg cursor-pointer border transition-all ${
                                highContrast 
                                ? 'border-yellow-400 hover:bg-yellow-400 hover:text-black' 
                                : 'bg-slate-800 border-slate-700 hover:border-indigo-500'
                            }`}
                        >
                            <div className="font-medium text-sm truncate">{comp.name}</div>
                            <div className="text-xs opacity-50">{new Date(comp.timestamp).toLocaleDateString()}</div>
                        </div>
                    ))}
                    {compositions.length === 0 && (
                        <p className="text-xs opacity-40 italic text-center py-4">No saved compositions</p>
                    )}
                </div>
            </div>
         </div>

         {/* 3. Main Workspace */}
         <div className="flex-1 flex flex-col p-6 overflow-y-auto relative">
             <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
                
                {/* Canvas Visualizer */}
                <div className={`w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden mb-8 border relative ${highContrast ? 'border-yellow-400' : 'border-slate-700 bg-black shadow-2xl'}`}>
                   <canvas 
                      ref={canvasRef} 
                      className="w-full h-full" 
                      width={800} 
                      height={400} 
                   />
                   {voiceControl && (
                       <div className="absolute top-4 right-4 bg-red-500 text-white text-xs px-2 py-1 rounded animate-pulse">
                           Listening...
                       </div>
                   )}
                </div>

                {/* Sequencer Grid */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end mb-2">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Music className="text-indigo-500" /> Pattern Sequencer
                        </h3>
                        <span className="text-xs font-mono opacity-50">16 STEPS</span>
                    </div>
                    
                    <div className="grid grid-cols-8 md:grid-cols-16 gap-1 md:gap-2">
                        {sequencerGrid.map((active, idx) => (
                            <button
                                key={idx}
                                onClick={() => toggleStep(idx)}
                                className={`
                                    aspect-[2/3] md:aspect-square rounded-md transition-all relative overflow-hidden group
                                    ${active 
                                        ? (highContrast ? 'bg-yellow-400 shadow-[0_0_10px_#ffff00]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] transform scale-105') 
                                        : (highContrast ? 'bg-gray-800 border border-gray-600' : 'bg-slate-800 hover:bg-slate-700')
                                    }
                                    ${currentStep === idx ? 'ring-2 ring-white z-10 scale-110' : ''}
                                `}
                            >
                                <span className={`absolute bottom-1 right-1 text-[8px] font-mono ${active ? 'text-black' : 'text-slate-500'}`}>
                                    {idx + 1}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

             </div>
             
             {/* Info Footer */}
             <div className="mt-8 text-center opacity-40 text-xs">
                <p>Browser Audio Context: {audioCtxRef.current?.state}</p>
                <p>Use Spacebar for Play/Stop when Voice Control is Active</p>
             </div>
         </div>

      </div>
    </div>
  );
};

export default MusicHubInterface;
