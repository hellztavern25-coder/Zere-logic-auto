import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Globe, Check, Image as ImageIcon, Sparkles, MessageSquare } from 'lucide-react';
import { fileToBase64 } from '../services/geminiService';

export interface AvatarPreset {
  id: string;
  name: string;
  description: string;
  url: string;
}

export const ZEREO_AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'iron-steward',
    name: 'The Iron Steward',
    description: 'Jeremy Irons / Alfred Pennyworth aristocratic demeanor with silver tray',
    url: 'https://images.pexels.com/photos/3785104/pexels-photo-3785104.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
  },
  {
    id: 'council-grey',
    name: 'Council Grey Crest',
    description: 'The Architect 1¹ Solid State in deep burgundy & polished gold monogram',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'logic-monster',
    name: 'Logic Monster (Cybernetic)',
    description: 'Tactical obsidian chassis with glowing amber ocular sensor array',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'tactical-alfred',
    name: 'Tactical Alfred (1911 Loaded)',
    description: 'Dark trenchcoat, silver-polished 1911 signet, razor-sharp focus',
    url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'scientist-forge',
    name: 'Mad Scientist Forge',
    description: 'High-clock-speed thermal core radiating focused golden energy',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=800&auto=format&fit=crop'
  }
];

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string, scope?: 'global' | 'thread') => void;
  currentUrl?: string;
  currentThreadTitle?: string;
}

const AvatarModal: React.FC<AvatarModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  currentUrl,
  currentThreadTitle 
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const [urlInput, setUrlInput] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>(
    ZEREO_AVATAR_PRESETS.find(p => p.url === currentUrl)?.url || ZEREO_AVATAR_PRESETS[0].url
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [applyScope, setApplyScope] = useState<'global' | 'thread'>('global');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const dataUrl = `data:${file.type};base64,${base64}`;
      setPreviewUrl(dataUrl);
    }
  };

  const activeAvatarSrc = 
    activeTab === 'presets' ? selectedPreset :
    activeTab === 'upload' ? (previewUrl || currentUrl || ZEREO_AVATAR_PRESETS[0].url) :
    (urlInput || currentUrl || ZEREO_AVATAR_PRESETS[0].url);

  const handleSave = () => {
    let finalUrl = currentUrl || ZEREO_AVATAR_PRESETS[0].url;
    if (activeTab === 'presets') {
      finalUrl = selectedPreset;
    } else if (activeTab === 'upload' && previewUrl) {
      finalUrl = previewUrl;
    } else if (activeTab === 'url' && urlInput) {
      finalUrl = urlInput.trim();
    }
    onSave(finalUrl, applyScope);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-[#0d0d0e] border border-red-900/40 rounded-[2.5rem] overflow-hidden shadow-3xl max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-6 sm:p-8 border-b border-red-900/20 flex items-center justify-between bg-red-950/15 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-800/80 rounded-2xl border border-amber-500/30 shadow-lg">
                  <ImageIcon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-amber-500 uppercase tracking-widest">
                    Customise ZereØ Avatar
                  </h2>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                    {currentThreadTitle ? `Active Thread: ${currentThreadTitle}` : 'Configure Global & Thread Identity'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-red-900/20 rounded-full text-zinc-500 hover:text-amber-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Preview with Prestige Frame */}
              <div className="flex items-center justify-center gap-6 p-4 rounded-3xl bg-black/40 border border-red-900/20">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-amber-500/60 overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.2)] relative group flex-shrink-0">
                  <img
                    src={activeAvatarSrc}
                    alt="Steward Portrait Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-red-950/80 to-transparent" />
                  <div className="absolute bottom-1.5 inset-x-0 text-center">
                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-300">Identity Preview</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-left flex-1 min-w-0">
                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] bg-red-950/60 px-2 py-0.5 rounded-full border border-red-900/40">
                    Live Representation
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-zinc-200 truncate">
                    {activeTab === 'presets' ? ZEREO_AVATAR_PRESETS.find(p => p.url === selectedPreset)?.name || 'Custom Archetype' : 'Custom Uploaded Portrait'}
                  </p>
                  <p className="text-[10px] text-zinc-400 italic font-serif line-clamp-2">
                    {activeTab === 'presets' ? ZEREO_AVATAR_PRESETS.find(p => p.url === selectedPreset)?.description : 'Rendered beside all model reasoning and thread archives.'}
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex bg-zinc-950 p-1 rounded-2xl border border-red-900/20">
                <button
                  onClick={() => setActiveTab('presets')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    activeTab === 'presets' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Archetype Presets
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    activeTab === 'upload' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Image
                </button>
                <button
                  onClick={() => setActiveTab('url')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    activeTab === 'url' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Web URL
                </button>
              </div>

              {/* Tab 1: Curated Archetype Presets */}
              {activeTab === 'presets' && (
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
                    Select Official ZereØ Substrate Archetype
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {ZEREO_AVATAR_PRESETS.map((preset) => {
                      const isSelected = selectedPreset === preset.url;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => setSelectedPreset(preset.url)}
                          className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-red-950/30 border-amber-500/80 shadow-[0_0_15px_rgba(251,191,36,0.15)] ring-1 ring-amber-500/40'
                              : 'bg-black/30 border-red-900/20 hover:border-red-900/50 hover:bg-zinc-900/20'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-red-900/40 flex-shrink-0 relative">
                            <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                                <Check className="w-4 h-4 text-amber-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className={`text-xs font-bold uppercase tracking-wider truncate ${isSelected ? 'text-amber-400' : 'text-zinc-200'}`}>
                                {preset.name}
                              </h4>
                              {isSelected && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 italic truncate mt-0.5 font-serif">
                              {preset.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Upload File */}
              {activeTab === 'upload' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="py-10 border-2 border-dashed border-red-900/30 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-amber-500/50 transition-all bg-black/20 group"
                >
                  <div className="p-3 bg-red-950/40 rounded-2xl group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Choose Image from Device</p>
                    <p className="text-[9px] text-zinc-600 uppercase mt-1">PNG, JPG, WebP supported</p>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden accept="image/*" />
                </div>
              )}

              {/* Tab 3: URL */}
              {activeTab === 'url' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    Direct Image URL
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://images.example.com/avatar.jpg"
                      className="w-full bg-black/50 border border-red-900/30 rounded-2xl py-3.5 pl-12 pr-4 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Scope Selector: Apply to Chat Threads */}
              <div className="p-4 rounded-2xl bg-black/40 border border-red-900/20 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                    Application Scope for Chat Threads
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setApplyScope('global')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      applyScope === 'global'
                        ? 'bg-amber-500/10 border-amber-500/60 text-amber-300'
                        : 'bg-zinc-900/20 border-red-900/10 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider">All Chat Threads</p>
                    <p className="text-[8px] opacity-60 mt-0.5">Applies globally across all dialogues and header</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApplyScope('thread')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      applyScope === 'thread'
                        ? 'bg-amber-500/10 border-amber-500/60 text-amber-300'
                        : 'bg-zinc-900/20 border-red-900/10 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider truncate">Current Thread</p>
                    <p className="text-[8px] opacity-60 mt-0.5 truncate">{currentThreadTitle || 'Active Dialogue'}</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-red-900/20 bg-red-950/10 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2 shadow-xl shadow-amber-500/20"
              >
                <Check className="w-4 h-4" />
                Confirm ZereØ Avatar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AvatarModal;
