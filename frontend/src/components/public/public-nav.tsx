"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** Item-level active state: benar-benarkecuali halaman yang sedang dibuka. */
export default function PublicNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama">
      <ul className="flex items-center gap-7">
        {items.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(`${l.href}/`);

          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`ring-accent relative rounded-full px-4 py-2 text-[14px] transition-colors duration-200 hover:bg-paper-2 hover:text-ink ${
                  active ? "bg-paper-2 font-medium text-ink" : "text-ink-2"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
