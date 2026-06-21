import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  
  const startY = useRef(0);
  const currentY = useRef(0);
  const scrollParentRef = useRef<HTMLElement | null>(null);

  // Define pull threshold
  const PULL_THRESHOLD = 75;
  const MAX_PULL = 130;
  const FIRCTION = 0.4;

  const getScrollParent = (): HTMLElement | null => {
    if (scrollParentRef.current) return scrollParentRef.current;
    
    // Find central app scrolling frame
    const stage = document.getElementById('main_content_stage');
    if (stage) {
      scrollParentRef.current = stage;
      return stage;
    }
    
    // Fallback to window/body
    return null;
  };

  const handleStart = (y: number) => {
    if (isRefreshing) return;
    
    const scrollParent = getScrollParent();
    const scrollTop = scrollParent ? scrollParent.scrollTop : window.scrollY;
    
    if (scrollTop === 0) {
      startY.current = y;
      currentY.current = y;
      setIsPulling(true);
    }
  };

  const handleMove = (y: number) => {
    if (!isPulling || isRefreshing) return;

    currentY.current = y;
    const diff = currentY.current - startY.current;

    // Only handle pull down actions at scrollTop 0
    if (diff > 0) {
      // Prevent browser default scroll bounce behavior if pulling down
      const calculatedDistance = Math.min(MAX_PULL, diff * FIRCTION);
      setPullDistance(calculatedDistance);
    } else {
      setPullDistance(0);
    }
  };

  const handleEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD); // lock at action height
      try {
        await onRefresh();
      } catch (err) {
        console.error('Refresh data validation failed:', err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    handleMove(e.touches[0].clientY);
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  // Mouse handlers (for web testing support on desktop)
  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPulling) return;
    handleMove(e.clientY);
  };

  const onMouseUp = () => {
    handleEnd();
  };

  const onMouseLeave = () => {
    if (isPulling) handleEnd();
  };

  // Also bind global touchmove/touchend behavior to guarantee spring behavior is captured
  useEffect(() => {
    const preventOverscroll = (e: TouchEvent) => {
      if (isPulling && pullDistance > 0 && e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', preventOverscroll, { passive: false });
    return () => {
      window.removeEventListener('touchmove', preventOverscroll);
    };
  }, [isPulling, pullDistance]);

  const rotationAngle = (pullDistance / PULL_THRESHOLD) * 360;
  const progressRatio = Math.min(1, pullDistance / PULL_THRESHOLD);
  const isPastThreshold = pullDistance >= PULL_THRESHOLD;

  return (
    <div
      className="relative w-full h-full select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* Absolute floating pull-to-refresh feedback indicator widget */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            key="pull-indicator"
            initial={{ opacity: 0, y: -20, scale: 0.6 }}
            animate={{
              opacity: 1,
              y: pullDistance - 10,
              scale: isRefreshing ? 1 : 0.6 + progressRatio * 0.4,
            }}
            exit={{ opacity: 0, y: -20, scale: 0.5 }}
            transition={{
              type: 'spring',
              stiffness: isPulling ? 400 : 200,
              damping: isPulling ? 30 : 15,
            }}
            className="absolute left-0 right-0 z-50 flex justify-center pointer-events-none"
          >
            <div
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-lg backdrop-blur-xl transition-all duration-200 ${
                isPastThreshold || isRefreshing
                  ? 'bg-emerald-deep/90 border-emerald-deep text-white shadow-emerald-deep/20'
                  : 'bg-white/80 border-ink-deep/10 text-emerald-deep shadow-[#10231C]/5'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={
                    isRefreshing
                      ? { rotate: 360 }
                      : { rotate: rotationAngle }
                  }
                  transition={
                    isRefreshing
                      ? { repeat: Infinity, duration: 1, ease: 'linear' }
                      : { type: 'tween', ease: 'easeOut', duration: 0 }
                  }
                  className="w-4 h-4"
                >
                  <RefreshCw className="w-full h-full" />
                </motion.div>
              </div>
              <span className="text-[10px] font-display font-medium uppercase tracking-wider">
                {isRefreshing
                  ? 'Refreshing menu...'
                  : isPastThreshold
                  ? 'Release to refresh'
                  : 'Pull to refresh'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main page content wrap */}
      <motion.div
        animate={{
          y: isRefreshing ? 50 : pullDistance * 0.35,
        }}
        transition={{
          type: 'spring',
          stiffness: isPulling ? 500 : 250,
          damping: isPulling ? 35 : 18,
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </div>
  );
};
