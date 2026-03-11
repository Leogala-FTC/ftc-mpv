"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMyNotifications, markNotificationRead, markAllRead } from "@/app/actions/notifications";

type Notif = { id: string; title: string; body: string; read: boolean; created_at: string };

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unread = notifs.filter((n) => !n.read).length;

  async function load() {
    setLoading(true);
    const data = await getMyNotifications();
    setNotifs(data as Notif[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Polling ogni 30s
    return () => clearInterval(interval);
  }, []);

  // Chiudi cliccando fuori
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleMarkAll() {
    await markAllRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleClick(n: Notif) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
    setOpen(false);
    router.push("/notifiche");
  }

  const preview = notifs.slice(0, 5);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifiche"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Notifiche</p>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-indigo-600 hover:underline">
                Segna tutte come lette
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-72 overflow-y-auto">
            {loading && notifs.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Caricamento...</p>
            ) : preview.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Nessuna notifica</p>
            ) : (
              preview.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.read ? "bg-indigo-50" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    )}
                    <div className={!n.read ? "" : "ml-4"}>
                      <p className="text-sm font-medium text-gray-800 leading-tight">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100">
            <button
              onClick={() => { setOpen(false); router.push("/notifiche"); }}
              className="w-full text-center text-xs text-indigo-600 font-medium hover:underline"
            >
              Vedi tutte le notifiche →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
