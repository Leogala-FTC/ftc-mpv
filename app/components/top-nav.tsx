"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

type Role = "user" | "merchant" | "admin" | null;

const NAV_LINKS: Record<NonNullable<Role>, { href: string; label: string }[]> = {
  user: [
    { href: "/user", label: "Home" },
    { href: "/user/wallet", label: "Wallet" },
  ],
  merchant: [
    { href: "/merchant", label: "Home" },
    { href: "/merchant/sell", label: "Vendi" },
    { href: "/merchant/clearing", label: "Clearing" },
  ],
  admin: [
    { href: "/admin", label: "Dashboard" },
  ],
};

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from("profiles").select("role").eq("user_id", data.user.id).single()
        .then(({ data: prof }) => setRole((prof?.role as Role) ?? null));
    });
  }, [pathname]);

  if (pathname === "/") return null;

  const links = role ? NAV_LINKS[role] ?? [] : [];

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <nav className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <div className="flex items-center gap-4">
          <Link className="text-sm font-semibold" href={role ? `/${role === "admin" ? "admin" : role}` : "/"}>
            FTC
          </Link>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm ${pathname === l.href ? "text-black font-medium" : "text-gray-500 hover:text-gray-800"}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <button
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
          onClick={handleLogout}
          type="button"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
