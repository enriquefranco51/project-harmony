
import React, { useState, useEffect, useRef } from 'react';
import { Palette, Download, RefreshCw, MoreVertical, Edit2, X, Wand2 } from 'lucide-react';
import { generateImage, editImage } from '../services/geminiService';

const StudioInterface: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Edit State
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const images = await generateImage(prompt);
      setGeneratedImages(prev => [...images, ...prev]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditGenerate = async () => {
    if (!editingImage || !editPrompt.trim()) return;
    setIsEditing(true);
    try {
      const images = await editImage(editingImage, editPrompt);
      setGeneratedImages(prev => [...images, ...prev]);
      setEditingImage(null);
      setEditPrompt('');
    } catch (error) {
      console.error(error);
      alert("Failed to edit image. Please try again.");
    } finally {
      setIsEditing(false);
    }
  };

  const openEditModal = (e: React.MouseEvent, img: string) => {
    e.stopPropagation();
    setEditingImage(img);
    setActiveMenu(null);
  };

  const toggleMenu = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === idx ? null : idx);
  };

  return (
    <div className="h-full p-8 bg-slate-900 text-slate-100 flex flex-col overflow-hidden relative">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full gap-8">
        
        {/* Controls */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
            <label className="text-sm text-slate-400 font-medium">Album Art Concept</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A lo-fi hip hop album cover with a rainy window, neon signs in background, anime style..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 h-24 focus:ring-2 focus:ring-purple-500 outline-none resize-none text-slate-200 placeholder-slate-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full md:w-auto px-8 py-3 h-12 mb-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-medium shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" /> : <Palette size={20} />}
            <span>Generate Art</span>
          </button>
        </div>

        {/* Gallery */}
        <div className="flex-1 overflow-y-auto">
          {generatedImages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60">
               <Palette className="w-16 h-16 mb-4" />
               <p className="text-xl font-light">Create your first album cover</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
              {generatedImages.map((img, idx) => (
                <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-800 shadow-xl aspect-square">
                  <img src={img} alt={`Generated ${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                     <div className="flex items-center justify-end gap-2">
                        
                        <a href={img} download={`harmony-art-gen-${Date.now()}.png`} className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg text-white transition-colors" title="Download">
                           <Download size={20} />
                        </a>

                        {/* Context Menu Trigger */}
                        <div className="relative">
                            <button 
                              onClick={(e) => toggleMenu(e, idx)}
                              className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg text-white transition-colors"
                            >
                                <MoreVertical size={20} />
                            </button>
                            
                            {/* Dropdown Menu */}
                            {activeMenu === idx && (
                                <div className="absolute bottom-full right-0 mb-2 w-32 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-20">
                                    <button 
                                        onClick={(e) => openEditModal(e, img)}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-indigo-600 hover:text-white flex items-center gap-2"
                                    >
                                        <Edit2 size={14} />
                                        <span>Edit</span>
                                    </button>
                                </div>
                            )}
                        </div>

                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 relative shadow-2xl flex flex-col md:flex-row gap-6">
              <button 
                onClick={() => setEditingImage(null)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
              >
                <X size={24} />
              </button>

              <div className="flex-1 flex flex-col items-center justify-center bg-black/40 rounded-xl overflow-hidden border border-slate-800">
                  <img src={editingImage} alt="Editing Target" className="max-h-[300px] w-auto object-contain" />
              </div>

              <div className="flex-1 flex flex-col gap-4">
                  <div className="space-y-1">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Wand2 size={20} className="text-purple-400"/>
                          Edit Cover Art
                      </h3>
                      <p className="text-sm text-slate-400">Describe changes: 'Add band logo', 'Make it darker'...</p>
                  </div>
                  
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="e.g., Add a guitar leaning against the wall..."
                    className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none resize-none text-slate-200 placeholder-slate-500 text-sm min-h-[120px]"
                  />

                  <button
                    onClick={handleEditGenerate}
                    disabled={isEditing || !editPrompt.trim()}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isEditing ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />}
                    <span>Generate Edit</span>
                  </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default StudioInterface;
