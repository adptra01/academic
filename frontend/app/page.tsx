export default function Page() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Academic Research Analysis Platform — MVP</h1>
      <p className="mt-2 text-slate-600">Mesin analisis ilmiah deterministik adalah inti produk. AI hanya asisten opsional pasca-MVP.</p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Alur MVP</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">Register → Buat Project → Upload CSV/XLSX/XLS/SAV/JSON → Preview → Variabel → Preprocessing → 15 metode → Formula + Hasil → Grafik → Export → Reproducibility (Analysis ID).</p>
        <p className="mt-4 text-sm">
          <a href="/register" className="font-medium text-blue-700 hover:underline">Mulai dengan Register</a>
          <span className="mx-2 text-slate-300">·</span>
          <a href="/dashboard" className="font-medium text-blue-700 hover:underline">Buka Dashboard</a>
        </p>
        <p className="mt-2 text-xs text-slate-500">Lihat status backend: <a className="text-blue-700 hover:underline" href="http://localhost:8100/docs">API docs</a></p>
      </div>
    </>
  );
}
