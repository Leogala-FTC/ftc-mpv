"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const getSupabaseBrowser = () => createClientComponentClient();
