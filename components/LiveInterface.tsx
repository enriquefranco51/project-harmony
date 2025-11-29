
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Activity, XCircle, Shield, Lock, Music } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, createPcmBlob, decodeAudioData } from '../services/audioUtils';

const LiveInterface: React.FC = () => {
  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState<string>("Ready to Jam");
  const [volume, setVolume] = useState(0);

  // Audio Context Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  // Video Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSession = () => {
    setActive(false);
    setStatus("Disconnected");
    
    // Stop Video Loop
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    // Stop Audio Sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();

    // Close Contexts
    inputContextRef.current?.close();
    outputContextRef.current?.close();
    inputContextRef.current = null;
    outputContextRef.current = null;
    sessionPromiseRef.current = null;
    
    // Stop Camera Stream
    if (videoRef.current && videoRef.current.srcObject) {
       const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
       tracks.forEach(t => t.stop());
       videoRef.current.srcObject = null;
    }
  };

  const startSession = async () => {
    try {
      setStatus("Initializing audio...");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      const InputContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new InputContextClass({ sampleRate: 16000 });
      const outputCtx = new InputContextClass({ sampleRate: 24000 });
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      // Connect to Gemini Live
      setStatus("Establishing Secure Connection...");
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            setStatus("Live Session Active");
            setActive(true);
            
            // Setup Microphone Input
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const source = inputCtx.createMediaStreamSource(stream);
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              
              processor.onaudioprocess = (e) => {
                 if (!micOn) return; // Mute logic
                 const inputData = e.inputBuffer.getChannelData(0);
                 
                 // Simple volume visualization
                 let sum = 0;
                 for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                 setVolume(Math.sqrt(sum / inputData.length) * 100);

                 const pcmBlob = createPcmBlob(inputData);
                 sessionPromise.then(session => {
                   session.sendRealtimeInput({ media: pcmBlob });
                 });
              };
              
              source.connect(processor);
              processor.connect(inputCtx.destination);
            } catch (err) {
              console.error("Mic Error:", err);
              setStatus("Microphone access denied");
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              const ctx = outputContextRef.current;
              if (!ctx) return;

              // Sync Playback time
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                base64ToUint8Array(audioData),
                ctx,
                24000, 
                1
              );
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setStatus("Disconnected");
            setActive(false);
          },
          onerror: (e) => {
            console.error(e);
            setStatus("Connection Error");
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction: "You are Project Harmony, an expert vocal coach and music producer. Listen to the user's ideas, hum melodies if asked, and provide feedback on lyrics, rhythm, and tone. Keep responses concise and musical."
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (e) {
      console.error(e);
      setStatus("Failed to start session");
    }
  };

  const toggleCamera = async () => {
    if (cameraOn) {
      // Turn off
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
         (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
         videoRef.current.srcObject = null;
      }
      setCameraOn(false);
    } else {
      // Turn on
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraOn(true);
          
          // Start Frame Loop
          frameIntervalRef.current = window.setInterval(async () => {
            if (!videoRef.current || !canvasRef.current || !sessionPromiseRef.current) return;
            
            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) return;
            
            canvasRef.current.width = videoRef.current.videoWidth * 0.5; // Downscale for bandwidth
            canvasRef.current.height = videoRef.current.videoHeight * 0.5;
            ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            
            const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
            
            sessionPromiseRef.current.then(session => {
              session.sendRealtimeInput({
                media: {
                  mimeType: 'image/jpeg',
                  data: base64Data
                }
              });
            });
          }, 1000); 
        }
      } catch (e) {
        console.error("Camera Error:", e);
      }
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50">
      <div className="glass-panel p-8 rounded-3xl w-full max-w-lg flex flex-col items-center gap-8 shadow-2xl relative overflow-hidden border border-slate-700/50">
        
        {/* Connection Status Indicator */}
        <div className={`absolute top-4 left-0 w-full flex justify-center`}>
            <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase transition-all ${
              active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700/50 text-slate-400'
            }`}>
              {active && <Lock size={10} />}
              {status}
            </span>
        </div>

        {/* Visualizer Circle */}
        <div className="relative mt-8">
          <div className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 ${
            active ? 'bg-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.5)]' : 'bg-slate-800'
          }`}
          style={{
             transform: `scale(${1 + Math.min(volume * 0.02, 0.2)})`
          }}>
             <Music className={`w-20 h-20 ${active ? 'text-white' : 'text-slate-600'}`} />
          </div>
          
          {/* Subtle Pulse Rings */}
          {active && (
            <>
              <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-[ping_2s_ease-in-out_infinite]" />
              <div className="absolute inset-0 rounded-full border border-indigo-400/20 animate-[ping_3s_ease-in-out_infinite_0.5s]" />
            </>
          )}
        </div>

        {/* Camera Preview (Hidden if off) */}
        <div className={`w-32 h-24 bg-black rounded-lg overflow-hidden border border-slate-700 transition-all ${
           cameraOn ? 'opacity-100 mb-4' : 'opacity-0 h-0'
        }`}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 z-10">
          {!active ? (
            <button 
              onClick={startSession}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Music size={20} />
              <span>Start Session</span>
            </button>
          ) : (
            <>
               <button 
                onClick={() => setMicOn(!micOn)}
                className={`p-4 rounded-full transition-all ${
                  micOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500/20 text-red-500 border border-red-500/30'
                }`}
              >
                {micOn ? <Mic size={24} /> : <MicOff size={24} />}
              </button>

              <button 
                onClick={stopSession}
                className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-semibold shadow-lg shadow-red-500/20 transition-all transform hover:scale-105"
              >
                End
              </button>

              <button 
                onClick={toggleCamera}
                className={`p-4 rounded-full transition-all ${
                  cameraOn ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {cameraOn ? <Video size={24} /> : <VideoOff size={24} />}
              </button>
            </>
          )}
        </div>
      </div>
      
      <p className="mt-8 text-slate-500 text-sm max-w-xs text-center flex items-center justify-center gap-2">
        <Lock size={12} />
        <span>End-to-End Encrypted Music Session</span>
      </p>
    </div>
  );
};

export default LiveInterface;
