/** Mark: satu sumbu, titik data, dan garis tren — registration mark hasil plot. */
export default function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden="true"
        className="shrink-0 text-ink"
      >
        <path d="M2.75 23.25h20.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        <path d="M2.75 23.25V2.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        <path
          d="M5.5 19.4 11 12.8 16.4 15.4 23.25 5.9"
          pathLength="1"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-trace"
        />
        <circle cx="11" cy="12.8" r="1.7" fill="var(--primary)" />
        <circle cx="23.25" cy="5.9" r="1.7" fill="var(--primary)" />
      </svg>
      <span className="flex items-baseline gap-2">
        <span className="text-[15px] font-bold leading-none tracking-[-0.02em] text-ink">Academic</span>
        <span className="font-mono text-[9px] font-medium uppercase leading-none tracking-[0.22em] text-ink-3">
          platform
        </span>
      </span>
    </span>
  );
}
