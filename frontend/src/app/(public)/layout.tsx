import SiteHeader from "@/components/public/site-header";
import SiteFooter from "@/components/public/site-footer";

/**
 * Shell untuk seluruh halaman public. Halaman marketing berbagi header, grain,
 * dan footer; halaman aplikasi memakai shell sendiri di `(app)/layout.tsx`.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Tekstur atmosfer: fixed + pointer-events-none, tidak memicu repaint scroll. */}
      <div className="grain-layer" aria-hidden="true" />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
