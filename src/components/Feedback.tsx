import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// Toast (kort besked längst ned) och konfetti (vid något roligt). En provider för båda.

interface FeedbackCtx {
  toast: (text: string) => void;
  party: (text?: string) => void;
}

const Ctx = createContext<FeedbackCtx | null>(null);

const CONFETTI = ['var(--p)', 'var(--a)', '#F4B942', '#2EC4B6', '#FFFFFF'];

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  const [burst, setBurst] = useState(0);
  const tt = useRef<number>(0);
  const pt = useRef<number>(0);

  const toast = useCallback((text: string) => {
    setMsg((m) => ({ text, n: (m?.n ?? 0) + 1 }));
    window.clearTimeout(tt.current);
    tt.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);

  const party = useCallback(
    (text?: string) => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!reduce) {
        setBurst((b) => b + 1);
        window.clearTimeout(pt.current);
        pt.current = window.setTimeout(() => setBurst(0), 1700);
      }
      if (text) toast(text);
    },
    [toast],
  );

  useEffect(
    () => () => {
      window.clearTimeout(tt.current);
      window.clearTimeout(pt.current);
    },
    [],
  );

  const value = useMemo(() => ({ toast, party }), [toast, party]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fx" aria-hidden="true" key={burst}>
        {burst > 0 &&
          Array.from({ length: 26 }, (_, i) => {
            const w = 6 + (i % 3) * 2;
            return (
              <i
                key={i}
                style={{
                  left: `${(i * 37 + 11) % 100}%`,
                  width: w,
                  height: w * 1.6,
                  background: CONFETTI[i % 5],
                  animationDelay: `${(i % 7) * 0.05}s`,
                }}
              />
            );
          })}
      </div>
      <div className="toast-wrap" role="status" aria-live="polite">
        {msg && (
          <div className="toast" key={msg.n}>
            {msg.text}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFeedback används utanför FeedbackProvider');
  return c;
}
