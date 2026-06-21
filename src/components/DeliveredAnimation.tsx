import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Check, ShieldCheck, Heart } from 'lucide-react';

interface DeliveredAnimationProps {
  orderNumber: string;
  onDismiss: () => void;
}

export const DeliveredAnimation: React.FC<DeliveredAnimationProps> = ({ orderNumber, onDismiss }) => {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; color: string; delay: number }[]>([]);

  useEffect(() => {
    // Generate organic-looking confetti floating vectors
    const colors = ['#0F5132', '#16845B', '#F3B33D', '#F9E5C9', '#10231C'];
    const list = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 260, // scatter radius
      y: (Math.random() - 0.6) * 180, // scatter launch height
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.4,
    }));
    setParticles(list);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="bg-white/95 relative max-w-sm w-full rounded-3xl p-6 text-center border border-emerald-deep/15 shadow-2xl overflow-hidden backdrop-blur-xl"
      >
        {/* Dynamic background rings */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#16845B]/5 to-transparent pointer-events-none" />
        
        {/* Particle Canvas Area */}
        <div className="relative h-44 flex items-center justify-center">
          {/* Circular ripple effects (subtle vector waves) */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1.6], opacity: [0.6, 0.3, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeOut' }}
            className="absolute w-24 h-24 rounded-full border border-emerald-deep/20"
          />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.1, 1.4], opacity: [0.5, 0.25, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, delay: 0.7, ease: 'easeOut' }}
            className="absolute w-24 h-24 rounded-full border border-[#F3B33D]/30"
          />

          {/* Golden Sparkles radiating */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
            className="absolute"
          >
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, k) => (
              <motion.div
                key={k}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.7], y: [-15, -45, -25] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: k * 0.15, ease: 'easeInOut' }}
                style={{ transform: `rotate(${angle}deg)` }}
                className="absolute"
              >
                <Sparkles className="w-4 h-4 text-[#F3B33D] fill-[#F3B33D]/40" />
              </motion.div>
            ))}
          </motion.div>

          {/* Central delivered badge checking circle */}
          <motion.div
            initial={{ scale: 0.4, rotate: -45 }}
            animate={{ scale: 1.05, rotate: 0 }}
            transition={{ type: 'spring', delay: 0.1, stiffness: 250, damping: 15 }}
            className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#0F5132] to-[#16845B] text-white flex items-center justify-center shadow-lg shadow-emerald-deep/30 relative z-10"
          >
            {/* Draw checkmark path animatively using motion */}
            <svg viewBox="0 0 24 24" className="w-12 h-12 stroke-current text-white fill-none" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.4, ease: 'easeInOut' }}
                d="M20 6L9 17l-5-5"
              />
            </svg>
          </motion.div>

          {/* Self-launching Confetti particles */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
              animate={{
                x: p.x,
                y: p.y,
                scale: [0.4, 1.2, 0.9],
                opacity: [0, 1, 1, 0],
                rotate: [0, Math.random() * 360],
              }}
              transition={{
                duration: 1.6,
                delay: p.delay,
                ease: 'easeOut',
              }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                borderRadius: Math.random() > 0.4 ? '50%' : '15%',
                backgroundColor: p.color,
                zIndex: 5,
              }}
            />
          ))}
        </div>

        {/* Content text */}
        <div className="relative z-10 space-y-1.5 mt-2">
          <h3 className="font-display font-black text-lg text-emerald-strong">Takeaway Arrived! 🏁</h3>
          <p className="text-xs text-muted-grey px-4 leading-relaxed">
            Order item <span className="font-mono font-bold text-emerald-deep bg-emerald-deep/5 px-1.5 py-0.5 rounded text-[11px] border border-emerald-deep/8">{orderNumber}</span> has been securely dispatched at your preset location terminal desk.
          </p>
          <div className="inline-flex items-center gap-1 bg-[#16845B]/5 px-3 py-1 rounded-full text-[10px] font-bold text-[#16845B] mt-2 border border-[#16845B]/10">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Passes strict temperature & hygiene checks</span>
          </div>
        </div>

        {/* Close Button layout */}
        <div className="mt-6 relative z-10">
          <button
            onClick={onDismiss}
            className="w-full py-3.5 bg-[#10231C] text-white hover:bg-emerald-strong font-bold text-xs rounded-xl shadow-lg shadow-emerald-deep/15 transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Heart className="w-4 h-4 text-mango-warm fill-mango-warm" />
            <span>Sweet, Let's Eat!</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
