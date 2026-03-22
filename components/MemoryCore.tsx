import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Trash2, Clock, FileText, Search, Brain, Loader2, Cloud, Save } from 'lucide-react';

interface Memory {
  id: string;
  title: string;
  content: string;
  type: string;
  timestamp: string;
}

const MemoryCore: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/memories');
      const data = await res.json();
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMemory = async (id: string) => {
    try {
      await fetch(`/api/memories/${id}`, { method: 'DELETE' });
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      alert('Failed to delete memory');
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const filteredMemories = memories.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-black overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-8 border-b border-red-900/20 bg-red-950/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-red-800 rounded-xl sm:rounded-2xl shadow-lg shadow-red-900/40">
            <Database className="text-amber-400 w-5 h-5 sm:w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm sm:text-xl font-bold text-amber-500 uppercase tracking-[0.1em] sm:tracking-[0.3em]">Memory Core</h2>
            <p className="text-[8px] sm:text-[10px] text-zinc-600 uppercase tracking-widest font-mono">Persistent Strategic Archive • Cloud Synced</p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-900" />
          <input 
            type="text"
            placeholder="Search Archives..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/40 border border-red-900/20 rounded-2xl py-3 pl-12 pr-4 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Accessing Vault...</p>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale">
            <Brain className="w-24 h-24 mb-6" />
            <h3 className="text-xl font-light uppercase tracking-[0.4em]">Archive Empty</h3>
            <p className="text-xs mt-2 italic font-serif">"No strategic memories have been committed to the core yet, Principal."</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {filteredMemories.map((memory) => (
                <motion.div
                  key={memory.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-zinc-900/40 border border-red-900/20 rounded-3xl p-6 flex flex-col gap-4 hover:border-amber-500/30 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => deleteMemory(memory.id)}
                      className="p-2 bg-red-900/20 text-red-500 rounded-xl hover:bg-red-900/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-950/40 rounded-lg">
                      <FileText className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200 truncate pr-8">{memory.title}</h4>
                      <div className="flex items-center gap-2 text-[8px] text-zinc-600 uppercase font-mono mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(memory.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 text-xs text-zinc-400 font-serif italic leading-relaxed line-clamp-4">
                    {memory.content}
                  </div>

                  <div className="pt-4 border-t border-red-900/10 flex items-center justify-between">
                    <span className="text-[8px] font-black text-red-900 uppercase tracking-widest">{memory.type}</span>
                    <Cloud className="w-3 h-3 text-amber-900 opacity-30" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="p-4 border-t border-red-900/20 bg-red-950/5 flex justify-between px-8">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Cloud Sync: Synchronized</p>
        </div>
        <p className="text-[9px] font-bold text-red-900 uppercase tracking-widest">Vault Security: Maximum</p>
      </div>
    </div>
  );
};

export default MemoryCore;
