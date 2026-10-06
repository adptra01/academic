import Link from "next/link";
import Wordmark from "./wordmark";
import PublicNav from "./public-nav";
import { MobileNav, SessionLinks } from "./nav-parts";

export const NAV_ITEMS = [
  { href: "/", label: "Beranda" },
  { href: "/metode", label: "Metode" },
  { href: "/alur", label: "Alur kerja" },
  { href: "/reproduksi", label: "Reproduksi" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule/80 bg-paper/85 shadow-[inset_0_-1px_0_rgba(255,255,255,0.55)] backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="ring-accent rounded-md" aria-label="Academic Platform — beranda">
          <Wordmark />
        </Link>

        <div className="hidden md:block">
          <PublicNav items={NAV_ITEMS} />
        </div>

        <div className="flex items-center gap-2">
          <SessionLinks />
          <MobileNav items={NAV_ITEMS} />
        </div>
      </div>
    </header>
  );
}
