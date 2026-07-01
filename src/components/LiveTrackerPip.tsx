import React, { useEffect, useRef, useState } from 'react';
import { useMealDirect } from '../store';
import { Order, OrderStatus } from '../types';
import { MonitorPlay, XCircle } from 'lucide-react';

interface LiveTrackerPipProps {
  order: Order;
}

export const LiveTrackerPip: React.FC<LiveTrackerPipProps> = ({ order }) => {
  const { vendors } = useMealDirect();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Retained so the button can act as a real toggle and so we can tear the window down on unmount.
  const pipWindowRef = useRef<Window | null>(null);
  const pipLoopRef = useRef<number | null>(null);
  const [isPipActive, setIsPipActive] = useState(false);

  const vendorName = vendors.find(v => v.id === order.vendorId)?.name || 'Kitchen Partner';

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      if (!ctx || !canvas) return;

      // Ensure proper sizing
      canvas.width = 400;
      canvas.height = 300;

      // Draw Background
      ctx.fillStyle = '#0a0a0a'; // matches theme dark mode surface
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Top brand bar
      ctx.fillStyle = '#10b981'; // emerald-deep
      ctx.fillRect(0, 0, canvas.width, 10);

      // Header text
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 26px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Meal Direct Live Tracker', canvas.width / 2, 50);

      // Order info
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 16px -apple-system';
      ctx.fillText(`ORDER: ${order.orderNumber}`, canvas.width / 2, 90);
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px -apple-system';
      ctx.fillText(`From: ${vendorName}`, canvas.width / 2, 115);

      // Status translation — keyed to the real OrderStatus values the backend emits.
      const statusLabels: Partial<Record<OrderStatus, string>> = {
        PENDING_PAYMENT: 'AWAITING PAYMENT',
        PAID: 'PAYMENT CONFIRMED',
        ACCEPTED: 'KITCHEN ACCEPTED',
        PREPARING: 'MEAL IS PREPARING',
        READY: 'PACKAGED & READY',
        PICKED_UP: 'RIDER PICKED UP',
        OUT_FOR_DELIVERY: 'DISPATCH EN ROUTE',
        DELIVERED: 'DELIVERED AT TERMINAL',
        CONFIRMED: 'ORDER CONFIRMED',
        ESCALATED: 'UNDER REVIEW',
        CANCELLED: 'ORDER CANCELLED',
        REFUNDED: 'ORDER REFUNDED',
        EXPIRED: 'ORDER EXPIRED'
      };

      const displayStatus = statusLabels[order.status] || order.status.replace(/_/g, ' ');
      const isComplete = ['DELIVERED', 'CONFIRMED'].includes(order.status);
      const isTerminal = ['DELIVERED', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'EXPIRED'].includes(order.status);

      // Big Status Display
      ctx.fillStyle = isComplete ? '#10b981' : '#facc15';
      ctx.font = '900 24px -apple-system';
      ctx.fillText(displayStatus, canvas.width / 2, 170);

      // Progress bar calculations — advance through the real dispatch pipeline.
      const statusFlow: OrderStatus[] = ['PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
      let currentIndex = statusFlow.indexOf(order.status);
      if (currentIndex === -1) {
        if (order.status === 'CONFIRMED') currentIndex = statusFlow.length - 1;
        else currentIndex = 0; // pending payment / escalated / cancelled anchor at the start
      }

      // Draw Progress Bar Track
      const barWidth = 320;
      const barX = (canvas.width - barWidth) / 2;
      const barY = 220;
      const barHeight = 12;
      const radius = 6;

      ctx.fillStyle = '#262626';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, radius);
      ctx.fill();

      // Draw Progress Bar Fill
      const targetProgress = (currentIndex / Math.max(1, statusFlow.length - 1)) * barWidth;
      const progress = targetProgress > 0 ? targetProgress : 10; // at least 10px

      ctx.fillStyle = isComplete ? '#10b981' : '#facc15';
      ctx.beginPath();
      ctx.roundRect(barX, barY, progress, barHeight, radius);
      ctx.fill();

      // Animate pulsing dot
      if (!isTerminal) {
        const time = Date.now() / 1000;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(barX + progress, barY + barHeight / 2, 8 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#facc15';
        ctx.font = '12px -apple-system';
        ctx.fillText('Live Tracking Active...', canvas.width / 2, 260);
      } else {
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 14px -apple-system';
        ctx.fillText('Tracking Session Complete.', canvas.width / 2, 260);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [order.status, order.orderNumber, vendorName]);

  const handleTogglePip = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // If a Document PiP window is already open, treat the click as "close".
    // (requestWindow() throws InvalidStateError if called while one is already open.)
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close(); // the 'pagehide' listener resets refs + state
      return;
    }

    try {
      // 1. Try Document Picture-in-Picture API (Chrome/Edge Native OS Window)
      if ('documentPictureInPicture' in window) {
        // @ts-ignore
        const pipWindow: Window = await window.documentPictureInPicture.requestWindow({ width: 400, height: 300 });
        pipWindowRef.current = pipWindow;

        const pipCanvas = pipWindow.document.createElement('canvas');
        pipCanvas.width = 400; pipCanvas.height = 300;
        pipCanvas.style.width = '100%';
        pipCanvas.style.height = '100%';
        pipCanvas.style.display = 'block';
        pipWindow.document.body.style.margin = "0";
        pipWindow.document.body.style.backgroundColor = "#0a0a0a";
        pipWindow.document.body.appendChild(pipCanvas);
        setIsPipActive(true);

        // Push frames to the PiP window. Drive with the PiP window's OWN rAF so it keeps
        // painting while the app tab is backgrounded/minimized — the opener's rAF is throttled.
        const pipCtx = pipCanvas.getContext('2d');
        const loop = () => {
          if (pipWindow.closed) return;
          if (pipCtx && canvasRef.current) {
            pipCtx.drawImage(canvasRef.current, 0, 0);
          }
          pipLoopRef.current = pipWindow.requestAnimationFrame(loop);
        };
        loop();

        // Reset when the window closes for any reason (toggle button, native X, or unmount).
        pipWindow.addEventListener('pagehide', () => {
          if (pipLoopRef.current !== null) {
            pipWindow.cancelAnimationFrame(pipLoopRef.current);
            pipLoopRef.current = null;
          }
          pipWindowRef.current = null;
          setIsPipActive(false);
        });
        return; // Success
      }

      // 2. Try Standard Video Picture-in-Picture API
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else {
        if (!videoRef.current.srcObject) {
          // Setup stream with constraints if possible, but canvas stream usually fine
          const stream = canvasRef.current.captureStream(30); 
          videoRef.current.srcObject = stream;
        }
        await videoRef.current.play();
        
        // Apple iOS Safari specific PiP fallback
        // @ts-ignore
        if (videoRef.current.webkitSetPresentationMode) {
          // @ts-ignore
          videoRef.current.webkitSetPresentationMode('picture-in-picture');
          setIsPipActive(true);
        } else {
          await videoRef.current.requestPictureInPicture();
          setIsPipActive(true);
        }
      }
    } catch (err) {
      console.error('Home Screen Tracker PiP launch failed:', err);
      // 3. Fallback OS Integration (MediaSession + Notifications)
      try {
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
             new Notification("Meal Direct Tracker", { body: `Live Tracker active: Order is ${order.status}` });
          } else if (Notification.permission !== 'denied') {
             await Notification.requestPermission();
          }
        }
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: `Live Tracker: ${order.status}`,
            artist: "Meal Direct",
            album: `Order #${order.orderNumber}`
          });
        }
        // Even if PiP fails, we simulate an active state via OS Media Session
        setIsPipActive(true);
      } catch (fallbackErr) {
        console.error("All tracker fallbacks failed", fallbackErr);
      }
    }
  };

  // Close any open Document PiP window when the tracker leaves the screen.
  useEffect(() => {
    return () => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const enterHandler = () => setIsPipActive(true);
      const leaveHandler = () => setIsPipActive(false);

      video.addEventListener('enterpictureinpicture', enterHandler);
      video.addEventListener('leavepictureinpicture', leaveHandler);

      return () => {
        video.removeEventListener('enterpictureinpicture', enterHandler);
        video.removeEventListener('leavepictureinpicture', leaveHandler);
      };
    }
  }, []);

  return (
    <div className="bg-emerald-deep/5 border border-emerald-deep/12 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 w-full mt-4">
      {/* Hidden elements for Canvas API stream generation */}
      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} playsInline muted className="hidden" />
      
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-deep text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-md">
          PIP
        </div>
        <div>
          <h4 className="text-xs font-bold text-emerald-strong leading-tight">Home Screen Live Tracker</h4>
          <p className="text-[10px] text-muted-grey mt-0.5 leading-tight">Keep an eye on dispatch when app is minimized</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleTogglePip}
        className={`px-4 py-2 font-bold text-[10px] rounded-xl flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-sm whitespace-nowrap ${
          isPipActive 
            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
            : 'bg-emerald-strong hover:bg-emerald-deep text-white border border-transparent'
        }`}
        id="launch_homescreen_tracker"
      >
        {isPipActive ? (
          <>
            <XCircle className="w-3.5 h-3.5" />
            <span>Close Tracker Widget</span>
          </>
        ) : (
          <>
            <MonitorPlay className="w-3.5 h-3.5" />
            <span>Launch Tracker Widget</span>
          </>
        )}
      </button>
    </div>
  );
};
