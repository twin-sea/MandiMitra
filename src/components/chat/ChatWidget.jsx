import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Truck,
  TrendingUp,
  CalendarPlus,
  AlertCircle,
  CloudSun,
} from 'lucide-react';
import { sendChatMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Quick-start prompts for the real capabilities the assistant actually has
// on the backend (booking, queue status, live prices, grievances, weather) -
// not invented features. Tapping one sends it immediately.
const SUGGESTIONS = [
  { icon: Truck, label: 'Track my queue', text: 'What is my current queue status?' },
  { icon: TrendingUp, label: "Today's price", text: 'What is the live price for my crop today?' },
  { icon: CalendarPlus, label: 'Book a slot', text: 'I want to book a new mandi slot.' },
  { icon: AlertCircle, label: 'File a complaint', text: 'I want to file a complaint.' },
  { icon: CloudSun, label: 'Weather update', text: 'What is the weather like at my mandi today?' },
];

export function ChatWidget() {
  const { farmer } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  async function sendMessageText(text) {
    if (!text || isSending || !farmer) return;

    setMessages((prev) => [...prev, { sender: 'user', text }]);
    setInput('');
    setIsSending(true);
    setError('');

    try {
      // The chatbot now always uses the real logged-in farmer's own name and
      // phone number, instead of asking them to type it in every time.
      const data = await sendChatMessage({
        message: text,
        farmerName: farmer.name,
        farmerPhone: farmer.phone,
        history,
      });
      setMessages((prev) => [...prev, { sender: 'bot', text: data.reply }]);
      setHistory(data.history || []);
    } catch (err) {
      // QUOTA_EXCEEDED / CHATBOT_UNAVAILABLE are stable codes from the
      // backend (see server.js) for the real, expected case where the AI
      // provider's daily free-tier limit is used up for the day - a plain
      // "Chatbot service error" reads like the app is broken, when really
      // it's just this one assistant feature that's temporarily out of
      // capacity. Booking, queue tracking, and prices still work fine.
      if (err.message === 'QUOTA_EXCEEDED') {
        setError(
          'सहायक अभी व्यस्त है (The assistant has reached its daily limit) - please try again in a little while. Booking, queue tracking, and prices still work normally.'
        );
      } else if (err.message === 'CHATBOT_UNAVAILABLE') {
        setError(
          'सहायक अभी उपलब्ध नहीं है (The assistant is temporarily unavailable) - please try again shortly.'
        );
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleSend(e) {
    e.preventDefault();
    sendMessageText(input.trim());
  }

  // Chat only makes sense for a logged-in farmer - and this component is
  // only rendered inside the authenticated app layout anyway.
  if (!farmer) return null;

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors"
        aria-label="Open MandiMitra assistant"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-5 z-50 flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
              <MessageCircle className="h-5 w-5" />
              <div>
                <p className="font-heading text-sm font-semibold">MandiMitra सहायक (Assistant)</p>
                <p className="text-[11px] text-primary-foreground/75">
                  Real-time help for {farmer.name}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="space-y-4 pt-2">
                  <p className="text-center text-xs text-muted-foreground">
                    Ask about bookings, queue status, prices, weather, or file a complaint - or
                    tap a quick option below.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => sendMessageText(s.text)}
                          disabled={isSending}
                          className="flex items-center gap-1.5 rounded-full border bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/70 disabled:opacity-50"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.sender === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'mr-auto bg-muted text-foreground'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {isSending && (
                <div className="mr-auto flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Typing...
                </div>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 border-t p-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-input px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
