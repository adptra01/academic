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
                className={`ring-accent group relative rounded-sm py-1 text-[13.5px] font-medium transition-colors duration-300 hover:text-ink ${
                  active ? "text-ink" : "text-ink-2"
                }`}
              >
                {l.label}
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-0.5 left-0 h-px w-full origin-left bg-accent transition-transform duration-300 ${
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
