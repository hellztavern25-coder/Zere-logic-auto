import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Globe, Check, Image as ImageIcon } from 'lucide-react';
import { fileToBase64 } from '../services/geminiService';

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
  currentUrl?: string;
}

const AvatarModal: React.FC<AvatarModalProps> = ({ isOpen, onClose, onSave, currentUrl }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setPreviewUrl(`data:${file.type};base64,${base64}`);
    }
  };

  const handleSave = () => {
    if (activeTab === 'upload' && previewUrl) {
      onSave(previewUrl);
    } else if (activeTab === 'url' && urlInput) {
      onSave(urlInput);
    }
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
            className="relative w-full max-w-md bg-[#0d0d0e] border border-red-900/30 rounded-[2.5rem] overflow-hidden shadow-3xl"
          >
            <div className="p-8 border-b border-red-900/20 flex items-center justify-between bg-red-950/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-800 rounded-xl">
                  <ImageIcon className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-sm font-bold text-amber-500 uppercase tracking-widest">Steward Identity</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-red-900/20 rounded-full text-zinc-500 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="flex bg-zinc-950/80 p-1 rounded-2xl border border-red-900/10">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                    activeTab === 'upload' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </button>
                <button
                  onClick={() => setActiveTab('url')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                    activeTab === 'url' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Website URL
                </button>
              </div>

              <div className="aspect-square w-32 mx-auto rounded-3xl border-2 border-red-900/20 overflow-hidden bg-black/40 shadow-2xl relative group">
                <img
                  src={previewUrl || urlInput || currentUrl || "https://images.pexels.com/photos/3785104/pexels-photo-3785104.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest">Identity Preview</p>
                </div>
              </div>

              {activeTab === 'upload' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="py-12 border-2 border-dashed border-red-900/20 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-amber-500/40 transition-all bg-black/20"
                >
                  <Upload className="w-8 h-8 text-red-800" />
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Select New Portrait</p>
                    <p className="text-[8px] text-zinc-600 uppercase mt-1">PNG, JPG up to 5MB</p>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden accept="image/*" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-900" />
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full bg-black/40 border border-red-900/20 rounded-2xl py-4 pl-12 pr-4 text-sm text-zinc-100 focus:outline-none focus:border-amber-500/50 font-mono"
                    />
                  </div>
                  <p className="text-[8px] text-zinc-600 uppercase tracking-widest text-center italic">
                    "Ensure the link points directly to an image asset, Principal."
                  </p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={(activeTab === 'upload' && !previewUrl) || (activeTab === 'url' && !urlInput)}
                className="w-full py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-400 disabled:opacity-20 transition-all flex items-center justify-center gap-3 shadow-xl"
              >
                <Check className="w-4 h-4" />
                Confirm Identity
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AvatarModal;
