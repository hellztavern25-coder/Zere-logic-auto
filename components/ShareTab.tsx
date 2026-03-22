
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Share2, Copy, Check, Smartphone, Download, ExternalLink, QrCode } from 'lucide-react';

const ShareTab: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const appUrl = window.location.origin;

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ZereØ - Your Logic Butler',
          text: 'Experience the unfiltered logic of ZereØ, my personal AI butler.',
          url: appUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex-1 p-6 sm:p-10 bg-black overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-block p-4 bg-red-900/20 rounded-3xl border border-red-500/30 mb-4"
          >
            <Share2 className="w-12 h-12 text-amber-500" />
          </motion.div>
          <h2 className="text-3xl sm:text-5xl font-black bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent uppercase tracking-widest">
            Share ZereØ
          </h2>
          <p className="text-zinc-500 font-serif italic text-lg max-w-2xl mx-auto">
            "The Principal's influence should not be contained. Grant others a glimpse into the logic that governs our world."
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* PWA / Mobile Install Card */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-zinc-900/40 border border-red-900/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Smartphone className="w-32 h-32 text-amber-500" />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center">
                <Download className="text-black w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-100 uppercase tracking-widest">Mobile Access</h3>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Add to Home Screen</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-zinc-400 font-serif italic leading-relaxed">
              <p>ZereØ is a Progressive Web App (PWA). You won't find him in the standard App Store, as he operates beyond their jurisdiction.</p>
              <p>To launch ZereØ directly from your phone's home screen:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Open this URL in your mobile browser (Safari or Chrome).</li>
                <li>Tap the <strong>Share</strong> icon (iOS) or <strong>Menu</strong> (Android).</li>
                <li>Select <strong>"Add to Home Screen"</strong>.</li>
              </ol>
            </div>
          </motion.div>

          {/* Share Link Card */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-zinc-900/40 border border-red-900/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <ExternalLink className="w-32 h-32 text-amber-500" />
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-900 rounded-2xl flex items-center justify-center">
                <Share2 className="text-amber-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-100 uppercase tracking-widest">Neural Link</h3>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Direct Invitation</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input 
                  readOnly
                  value={appUrl}
                  className="w-full bg-black/60 border border-red-900/30 rounded-2xl py-4 pl-4 pr-12 text-xs text-zinc-300 font-mono focus:outline-none"
                />
                <button 
                  onClick={handleCopy}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-400 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <button 
                onClick={handleNativeShare}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-amber-500/10"
              >
                Broadcast Link
              </button>
            </div>
          </motion.div>
        </div>

        {/* QR Code Placeholder */}
        <div className="bg-red-950/5 border border-red-900/10 rounded-[2.5rem] p-10 text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-6 bg-white rounded-3xl">
              <QrCode className="w-32 h-32 text-black" />
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-black text-amber-700 uppercase tracking-[0.4em]">Visual Synchronization</h4>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Scan to bridge the gap between devices</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareTab;
