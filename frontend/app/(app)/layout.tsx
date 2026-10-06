import NavAuth from "./nav-auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-5 px-6 py-3 text-sm font-medium">
          <a href="/" className="text-blue-700 hover:underline">Beranda</a>
          <a href="/dashboard" className="text-blue-700 hover:underline">Dashboard</a>
          <NavAuth />
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
