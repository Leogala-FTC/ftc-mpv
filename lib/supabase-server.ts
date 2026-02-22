import { createRouteHandlerClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const getSupabaseServer = () => createServerComponentClient({ cookies });
export const getSupabaseRoute = () => createRouteHandlerClient({ cookies });
