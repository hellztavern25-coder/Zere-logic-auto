import React from 'react';
import { motion } from 'motion/react';
import { Zap, Shield, Terminal, Brain, Flame, MessageSquare, Image as ImageIcon, Database, Share as ShareIcon, Settings, Smartphone } from 'lucide-react';

interface HomeProps {
  onNavigate?: (tab: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const [isPWA, setIsPWA] = React.useState(false);

  const handleNavigate = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    } else {
      window.dispatchEvent(new CustomEvent('nav:change', { detail: tab }));
    }
  };

  React.useEffect(() => {
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-10 bg-black relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-red-900/10 blur-[120px] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-amber-900/10 blur-[120px] rounded-full -z-10 animate-pulse" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-4xl w-full text-center space-y-8 sm:space-y-12 relative z-10"
      >
        {/* The "Monkey Juggling TNT" Visual Representation */}
        <div className="relative inline-block">
          <motion.div
            animate={{ 
              rotate: [0, 2, -2, 0],
              y: [0, -10, 0]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="relative z-20"
          >
            <img 
              src="https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?q=80&w=1000&auto=format&fit=crop" 
              alt="Logic Monster Mascot"
              className="w-48 h-48 sm:w-80 h-80 object-cover rounded-[2rem] sm:rounded-[3rem] border-4 border-red-900/30 shadow-[0_0_50px_rgba(153,27,27,0.4)] grayscale hover:grayscale-0 transition-all duration-700"
            />
          </motion.div>
          
          {/* TNT Accents (Abstract) */}
          <motion.div 
            animate={{ y: [-20, 20, -20], rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            className="absolute -top-10 -right-10 w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/50"
          >
            <Flame className="text-white w-8 h-8" />
          </motion.div>
          <motion.div 
            animate={{ y: [20, -20, 20], rotate: -360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-10 -left-10 w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/50"
          >
            <Flame className="text-white w-8 h-8" />
          </motion.div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <h1 className="text-3xl sm:text-6xl font-black bg-gradient-to-b from-amber-100 via-amber-400 to-amber-700 bg-clip-text text-transparent uppercase tracking-[0.2em] sm:tracking-[0.4em]">
            ZereØ
          </h1>
          <p className="text-sm sm:text-xl font-serif italic text-zinc-400 max-w-2xl mx-auto leading-relaxed px-4 sm:px-0">
            "Welcome back, Principal. The systems are primed, the neural bridges are stable, and the chaos is perfectly balanced. How shall we disrupt the status quo today?"
          </p>
          {!isPWA && (
            <motion.button 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => handleNavigate('share')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] text-amber-500 uppercase tracking-widest hover:bg-amber-500/20 transition-all mt-4"
            >
              <Smartphone className="w-3 h-3" />
              Install ZereØ to Home Screen
            </motion.button>
          )}
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="pt-8 flex flex-col items-center gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigate('chat')}
              className="flex items-center gap-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-full text-[10px] text-amber-500 uppercase tracking-widest hover:bg-red-900/40 transition-all"
            >
              <Zap className="w-3 h-3" />
              Launch!
            </motion.button>

            <button 
              onClick={() => handleNavigate('chat')}
              className="group relative px-16 py-6 bg-gradient-to-br from-red-900 to-black border border-red-500/50 rounded-2xl overflow-hidden transition-all hover:scale-110 active:scale-95 shadow-[0_0_60px_rgba(153,27,27,0.4)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/20 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <div className="relative flex items-center gap-4">
                <MessageSquare className="w-6 h-6 text-amber-500" />
                <span className="text-amber-500 font-black uppercase tracking-[0.5em] text-lg">Launch ZereØ</span>
              </div>
            </button>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 pt-10 w-full">
          {[
            { id: 'chat', icon: MessageSquare, label: "Direct Dialogue", sub: "Neural Chat" },
            { id: 'creative', icon: ImageIcon, label: "Vision Manifest", sub: "Synthesis" },
            { id: 'memory', icon: Database, label: "Memory Core", sub: "Archive" },
            { id: 'share', icon: ShareIcon, label: "Share ZereØ", sub: "Broadcast" },
            { id: 'system', icon: Settings, label: "System Control", sub: "Core Config" }
          ].map((action, i) => (
            <button 
              key={i} 
              onClick={() => handleNavigate(action.id)}
              className="bg-zinc-900/40 border border-red-900/20 p-6 rounded-3xl backdrop-blur-md hover:border-amber-500/50 hover:bg-red-900/10 transition-all group text-center"
            >
              <action.icon className="w-6 h-6 text-amber-500 mb-3 mx-auto group-hover:scale-110 transition-transform" />
              <p className="text-[10px] font-black text-zinc-100 uppercase tracking-widest">{action.label}</p>
              <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mt-1">{action.sub}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Footer Status */}
      <div className="absolute bottom-6 sm:bottom-10 left-6 sm:left-10 right-6 sm:right-10 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 px-4 sm:px-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">System Integrity: 100%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[8px] sm:text-[10px] font-bold text-red-900 uppercase tracking-[0.3em]">Protocol: Mad Scientist</span>
        </div>
      </div>
    </div>
  );
};

export default Home;
