
import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Loader2, X } from 'lucide-react';
import { analyzeImage } from '../services/geminiService';

const VisionInterface: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(''); // Clear previous result
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    try {
      // Strip base64 prefix
      const base64Data = image.split(',')[1];
      const text = await analyzeImage(base64Data, prompt || "Describe the musical instruments or sheet music in this image.");
      setResult(text);
    } catch (error) {
      setResult("Error analyzing image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900 text-slate-100 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            Visual Analysis
          </h2>
          <p className="text-slate-400">Upload images of instruments, sheet music, or equipment for analysis.</p>
        </div>

        {/* Upload Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
             <div className="relative group w-full aspect-square bg-slate-800 rounded-2xl border-2 border-dashed border-slate-600 hover:border-indigo-500 hover:bg-slate-800/50 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden">
                {!image ? (
                  <>
                    <Upload className="w-12 h-12 text-slate-500 mb-4 group-hover:text-indigo-400 transition-colors" />
                    <p className="text-slate-400 font-medium group-hover:text-slate-200">Click to upload image</p>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </>
                ) : (
                  <>
                    <img src={image} alt="Uploaded" className="w-full h-full object-contain p-2" />
                    <button 
                      onClick={() => { setImage(null); setResult(''); }}
                      className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500/80 rounded-full text-white transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </>
                )}
             </div>
             
             <div className="space-y-2">
               <label className="text-sm text-slate-400 font-medium">Prompt (Optional)</label>
               <input 
                  type="text" 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., 'What key is this song in?', 'Identify this guitar'"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 placeholder-slate-500"
               />
             </div>

             <button
               onClick={handleAnalyze}
               disabled={!image || loading}
               className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
             >
               {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
               <span>Analyze</span>
             </button>
          </div>

          {/* Result Area */}
          <div className="glass-panel rounded-2xl p-6 min-h-[400px] flex flex-col">
            <h3 className="text-lg font-semibold text-slate-300 mb-4 border-b border-slate-700/50 pb-2">Analysis Result</h3>
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <p>Processing visual data...</p>
              </div>
            ) : result ? (
              <div className="flex-1 overflow-y-auto prose prose-invert prose-sm max-w-none">
                <p className="whitespace-pre-wrap leading-relaxed text-slate-200">{result}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                <p>Results will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisionInterface;
