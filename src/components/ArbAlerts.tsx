"use client";

import { useEffect, useRef, useState } from "react";
import { formatPct } from "@/lib/format";
import type { ArbOpportunity } from "@/lib/types";

interface Toast {
  id: string;
  title: string;
  body: string;
}

interface Props {
  arbs: ArbOpportunity[];
  thresholdPct: number; // e.g. 1 = alert on arbs >= 1%
  onSelect: (arb: ArbOpportunity) => void;
}

/**
 * Watches the live arb list between polls and raises a toast (plus an
 * optional browser notification) whenever a new opportunity above the
 * threshold appears.
 */
export default function ArbAlerts({ arbs, thresholdPct, onSelect }: Props) {
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const arbMap = useRef<Map<string, ArbOpportunity>>(new Map());

  useEffect(() => {
    arbMap.current = new Map(arbs.map((a) => [a.id, a]));

    if (!initialized.current) {
      // Don't alert for everything present on first load
      for (const a of arbs) seen.current.add(a.id);
      initialized.current = true;
      return;
    }

    for (const arb of arbs) {
      if (seen.current.has(arb.id)) continue;
      seen.current.add(arb.id);
      if (arb.profitPct * 100 < thresholdPct) continue;

      const toast: Toast = {
        id: arb.id,
        title: `New arb: +${formatPct(arb.profitPct)}`,
        body: `${arb.matchLabel} · ${arb.marketName}`,
      };
      setToasts((t) => [...t.slice(-2), toast]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== toast.id));
      }, 8000);

      if (notifyEnabled && typeof Notification !== "undefined") {
        try {
          new Notification(toast.title, { body: toast.body });
        } catch {
          // notifications unavailable
        }
      }
    }
  }, [arbs, thresholdPct, notifyEnabled]);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      setNotifyEnabled(true);
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifyEnabled(perm === "granted");
  };

  return (
    <>
      <button
        onClick={() =>
          notifyEnabled ? setNotifyEnabled(false) : requestNotifications()
        }
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          notifyEnabled
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-edge bg-surface text-muted hover:text-foreground"
        }`}
        title="Get a desktop notification when a new arb above 1% opens"
      >
        {notifyEnabled ? "🔔 Alerts on" : "🔕 Alerts off"}
      </button>

      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            onClick={() => {
              const arb = arbMap.current.get(toast.id);
              if (arb) onSelect(arb);
              setToasts((t) => t.filter((x) => x.id !== toast.id));
            }}
            className="toast-in rounded-xl border border-accent/50 bg-surface-2 p-3 text-left shadow-xl transition-transform hover:scale-[1.02]"
          >
            <p className="text-sm font-bold text-accent">{toast.title}</p>
            <p className="text-xs text-muted">{toast.body}</p>
            <p className="mt-1 text-[10px] text-muted">
              Click to open the stake splitter
            </p>
          </button>
        ))}
      </div>
    </>
  );
}
