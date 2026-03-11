"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Service role client — bypasses RLS, server-only
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata");
  return createSupabaseClient(url, serviceKey);
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Non autenticato");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Accesso negato");
}

export async function getAdminUsers() {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db
    .from("profiles")
    .select("user_id,role,full_name,business_name,city,onboarding_completed,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminPayments() {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminClearings() {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db
    .from("clearing_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateClearingStatus(id: string, status: string) {
  await assertAdmin();
  const db = getServiceClient();
  const { error } = await db
    .from("clearing_requests")
    .update({ status })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
