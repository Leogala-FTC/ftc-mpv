"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyNotifications, markNotificationRead, markAllRead } from "@/app/actions/notifications";

type Notif = { id: string; title: string; body: string; read: boolean; created_at: string };

export default function NotifichePage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getMyNotifications().then((data) => {
      setNotifs(data as Notif[]);
      setLoading(false);
    });
  }, []);

  async function handleRead(n: Notif) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
  }

  async function handleMarkAll() {
    await markAllRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Notifiche</h1>
          {unread > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unread} non {unread === 1 ? "letta" : "lette"}</p>
          )}
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={handleMarkAll}
              className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50">
              Segna tutte lette
            </button>
          )}
          <button onClick={() => router.back()}
            className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            ← Indietro
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-sm">Nessuna notifica per ora</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifs.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => handleRead(n)}
                className={`w-full text-left rounded-xl border px-4 py-4 transition-colors ${
                  n.read ? "bg-white border-gray-100" : "bg-indigo-50 border-indigo-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />}
                  <div className={n.read ? "" : ""}>
                    <p className={`text-sm leading-snug ${n.read ? "font-medium text-gray-700" : "font-semibold text-gray-900"}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(n.created_at).toLocaleDateString("it-IT", {
                        day: "2-digit", month: "long", year: "numeric",
                        hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
