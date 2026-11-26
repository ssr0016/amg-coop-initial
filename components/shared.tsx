"use client";

"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert, LoaderCircle, PackageOpen } from "lucide-react";
import { statusLabel, type OrderStatus } from "../lib/models";

const ActionContext = createContext<(action: () => void, message?: string) => boolean>(() => false);
export const useAction = () => useContext(ActionContext);

type Feedback = { id: number; text: string; error: boolean };

function Toast({ feedback, dismiss }: { feedback: Feedback; dismiss: (id: number) => void }) {
  const { id, text, error } = feedback;
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(id), 3000);
    return () => window.clearTimeout(timer);
  }, [id, dismiss]);

  return <div className={`notice ${error ? "bg-[#8d3025]" : "bg-(--forest)"}`}>
    <span className="flex min-w-0 items-center gap-2 wrap-anywhere">
      {error ? <CircleAlert className="size-4 shrink-0" aria-hidden /> : <Check className="size-4 shrink-0" aria-hidden />}
      {text}
    </span>
    <button type="button" aria-label="Dismiss message" onClick={() => dismiss(id)}>×</button>
  </div>;
}

export function ActionProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setFeedback((current) => current.filter((toast) => toast.id !== id)), []);

  const act = useCallback((action: () => void, message?: string) => {
    function notify(text: string, error: boolean) {
      const toast = { id: nextId.current++, text, error };
      setFeedback((current) => [...current, toast]);
    }

    try {
      action();
      if (message) notify(message, false);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Please try again.", true);
      return false;
    }
  }, []);

  return <ActionContext.Provider value={act}>
    {children}
    <div className="notifications" aria-live="polite" aria-relevant="additions">
      {feedback.map((toast) => <Toast key={toast.id} feedback={toast} dismiss={dismiss} />)}
    </div>
  </ActionContext.Provider>;
}

export function usePendingAction() {
  const act = useAction();
  const [pending, setPending] = useState<string>();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function run(action: () => void, message: string, key = "submit") {
    if (timer.current !== undefined) return;
    setPending(key);
    timer.current = window.setTimeout(() => {
      act(action, message);
      timer.current = undefined;
      setPending(undefined);
    }, 500);
  }

  return { pending, run };
}

export function PendingLabel({ children }: { children: ReactNode }) {
  return <><LoaderCircle size={16} className="shrink-0 motion-safe:animate-spin" aria-hidden />{children}</>;
}

export function Status({ value }: { value: OrderStatus }) {
  return <span className={`status status-${value}`}>
    {value === "completed" && <Check size={14} aria-hidden />}
    {statusLabel[value]}
  </span>;
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="empty"><PackageOpen size={30} aria-hidden /><p>{children}</p>{action}</div>;
}
