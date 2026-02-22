import Link from "next/link";

export function AppNav({ links }: { links: { href: string; label: string }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="rounded-full border border-ftc-soap px-3 py-1">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
