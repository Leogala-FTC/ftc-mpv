"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non autenticato");
  const { data: p } = await supabase.from("profiles").select("role").eq("user_id", data.user.id).single();
  if (p?.role !== "admin") throw new Error("Accesso negato");
}

/** Notifiche dell'utente corrente */
export async function getMyNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("notifications")
    .select("id,title,body,read,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Conteggio non lette */
export async function getUnreadCount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);
  return count ?? 0;
}

/** Marca come letta */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read: true })
    .eq("id", notificationId).eq("user_id", user.id);
  revalidatePath("/notifiche");
}

/** Marca tutte come lette */
export async function markAllRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read: true })
    .eq("user_id", user.id).eq("read", false);
  revalidatePath("/notifiche");
}

/** Admin: invia notifica a uno o più utenti */
export async function adminSendNotification({
  title,
  body,
  targetRole,
  targetSector,
}: {
  title: string;
  body: string;
  targetRole?: string; // "all" | "user" | "merchant" | "admin"
  targetSector?: string;
}) {
  await assertAdmin();
  const db = getDb();

  // Trova gli utenti target
  let query = db.from("profiles").select("user_id");
  if (targetRole && targetRole !== "all") {
    query = query.eq("role", targetRole) as typeof query;
  }
  if (targetSector) {
    query = query.eq("sector", targetSector) as typeof query;
  }

  const { data: profiles } = await query;
  if (!profiles?.length) return { success: false, error: "Nessun utente trovato" };

  const notifications = profiles.map((p) => ({
    user_id: p.user_id,
    title,
    body,
    read: false,
    created_at: new Date().toISOString(),
  }));

  // Insert a batch di 100
  for (let i = 0; i < notifications.length; i += 100) {
    await db.from("notifications").insert(notifications.slice(i, i + 100));
  }

  return { success: true, count: notifications.length };
}
