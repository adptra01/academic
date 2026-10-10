import SiteHeader from "@/components/public/site-header";
import SiteFooter from "@/components/public/site-footer";

/**
 * Shell untuk seluruh halaman publik. Halaman marketing berbagi header
 * dan footer; halaman aplikasi memakai shell sendiri di `(app)/layout.tsx`.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
