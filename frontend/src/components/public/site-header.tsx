import Link from "next/link";
import Wordmark from "./wordmark";
import PublicNav from "./public-nav";
import { MobileNav, SessionLinks } from "./nav-parts";
import ModeToggle from "@/components/layout/ModeToggle";

export const NAV_ITEMS = [
  { href: "/", label: "Beranda" },
  { href: "/metode", label: "Metode" },
  { href: "/alur", label: "Alur kerja" },
  { href: "/reproduksi", label: "Reproduksi" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-paper/70 backdrop-blur-sm">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="ring-accent rounded-md" aria-label="Academic Platform — beranda">
          <Wordmark />
        </Link>

        <div className="hidden md:block">
          <PublicNav items={NAV_ITEMS} />
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle className="hidden sm:inline-flex" />
          <SessionLinks />
          <MobileNav items={NAV_ITEMS} />
        </div>
      </div>
    </header>
  );
}
