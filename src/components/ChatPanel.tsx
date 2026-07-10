import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X, Loader2 } from 'lucide-react';
import { apiRequest } from '../store';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  batchId: string;
  onClose: () => void;
}

// API returns newest-first; flip to chronological for a natural transcript.
async function loadMessages(batchId: string): Promise<ChatMessage[]> {
  const data = await apiRequest(`/batches/${batchId}/chat/messages?limit=50`);
  const list: ChatMessage[] = Array.isArray(data) ? data : [];
  return [...list].reverse();
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ batchId, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        const list = await loadMessages(batchId);
        setMessages(list);
        setError(false);
      } catch {
        if (showSpinner) setError(true);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [batchId],
  );

  // Initial load + poll every 3s while the tab is visible.
  useEffect(() => {
    void refresh(true);
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(false);
    }, 3000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await apiRequest(`/batches/${batchId}/chat/messages`, 'POST', { body });
      setDraft('');
      await refresh(false);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Could not send. Try again.');
    } finally {
      setSending(false);
    }
  }, [draft, sending, batchId, refresh]);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg h-[85vh] sm:h-[70vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-deep/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-full bg-emerald-deep/10 text-emerald-strong flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-emerald-strong text-sm truncate">Delivery chat</h3>
              <p className="text-[10px] text-muted-grey">You appear to others only as “Customer”. Names stay private.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-grey hover:text-emerald-strong shrink-0" aria-label="Close chat">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-emerald-deep/[0.02]">
          {loading && (
            <div className="h-full flex items-center justify-center text-muted-grey">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          {error && !loading && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-xs text-muted-grey">Could not load the chat.</p>
              <button onClick={() => void refresh(true)} className="px-4 py-2 rounded-xl bg-emerald-strong text-white text-xs font-bold">
                Retry
              </button>
            </div>
          )}
          {!loading && !error && messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-grey px-6">
              <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-xs">No messages yet. Your rider will post updates here.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                  m.mine
                    ? 'bg-emerald-strong text-white rounded-br-sm'
                    : 'bg-white text-gray-800 border border-emerald-deep/10 rounded-bl-sm shadow-xs'
                }`}
              >
                {!m.mine && (
                  <p className={`text-[10px] font-bold mb-0.5 ${m.senderRole === 'rider' ? 'text-emerald-strong' : 'text-muted-grey'}`}>
                    {m.senderLabel}
                    {m.senderRole === 'rider' ? ' · Rider' : ''}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[9px] mt-1 text-right ${m.mine ? 'text-white/70' : 'text-muted-grey'}`}>{formatTime(m.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-emerald-deep/10 px-3 py-3 shrink-0">
          {sendError && <p className="text-[10px] text-red-600 mb-2 px-1">{sendError}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={1}
              placeholder="Message your rider…"
              className="flex-1 resize-none bg-white border border-emerald-deep/15 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-strong/40 max-h-28"
            />
            <button
              onClick={() => void submit()}
              disabled={sending || draft.trim().length === 0}
              className="min-h-11 min-w-11 rounded-2xl bg-emerald-strong text-white flex items-center justify-center hover:bg-emerald-deep disabled:opacity-50 shrink-0"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
