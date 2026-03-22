
import React from 'react';

interface ButlerAvatarProps {
  isTalking?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isTurbo?: boolean;
  src?: string;
  onClick?: () => void;
}

const ButlerAvatar: React.FC<ButlerAvatarProps> = ({ 
  isTalking, 
  size = 'md', 
  className = '', 
  isTurbo = false,
  src,
  onClick
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-32 h-32',
    xl: 'w-56 h-56'
  };

  const defaultAvatar = "https://images.pexels.com/photos/3785104/pexels-photo-3785104.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2";

  return (
    <div 
      className={`relative flex-shrink-0 flex items-center justify-center ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Prestige Aura */}
      {(isTalking || isTurbo) && (
        <div className={`absolute inset-0 rounded-full blur-[40px] transition-all duration-1000 ${
          isTurbo ? 'bg-amber-400/30 animate-pulse' : 'bg-red-900/20'
        }`} />
      )}

      <div className={`
        ${sizeClasses[size]}
        rounded-2xl 
        overflow-hidden 
        border-2 
        transition-all 
        duration-1000
        z-10
        ${isTalking 
          ? 'border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.4)] scale-105 -translate-y-1' 
          : 'border-red-900/40 shadow-2xl scale-100'
        }
        ${isTurbo ? 'ring-2 ring-amber-400/40' : ''}
      `}>
        {/* Background for the portrait to give it the "Logic Monster" studio feel */}
        <div className="absolute inset-0 bg-gradient-to-t from-red-950/80 to-transparent z-10" />
        <img 
          src={src || defaultAvatar} 
          alt="The Steward"
          className={`w-full h-full object-cover transition-all duration-500 ${
            isTalking ? 'brightness-110 contrast-110 saturate-[0.8]' : 'brightness-75 contrast-125 grayscale-[0.2]'
          }`}
        />
        
        {/* Subtle Gleam in the eyes - Intelligent and sharp */}
        <div className={`absolute top-[32%] left-[42%] w-1 h-1 bg-amber-200 rounded-full blur-[0.5px] shadow-[0_0_8px_white] transition-opacity duration-500 ${isTalking ? 'opacity-80' : 'opacity-20'}`} />
        <div className={`absolute top-[32%] left-[54%] w-1 h-1 bg-amber-200 rounded-full blur-[0.5px] shadow-[0_0_8px_white] transition-opacity duration-500 ${isTalking ? 'opacity-80' : 'opacity-20'}`} />
      </div>
      
      {/* Refined Scanline */}
      {isTalking && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
           <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-logic-scan" />
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes logic-scan {
          0% { transform: translateY(0%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(300%); opacity: 0; }
        }
        .animate-logic-scan {
          animation: logic-scan 2s infinite ease-in-out;
        }
      `}} />
    </div>
  );
};

export default ButlerAvatar;
