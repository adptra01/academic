"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  variant?: "up" | "left" | "scale";
  /** Posisi dalam-waterfall reveal —KHUSUS untuk stagger. */
  index?: number;
  as?: ElementType;
};

/**
 * Satu IntersectionObserver dipakai bersama untuk seluruh halaman — bukan satu
 * per elemen, dan tanpa scroll listener di main thread.
 */
let observer: IntersectionObserver | null = null;

function ensureObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer?.unobserve(entry.target);
        }
      },
      // threshold 0 + rootMargin negatif: tetap terpicu walau elemen lebih tinggi
      // dari viewport (threshold pecahan tidak akan tercapai di kasus itu).
      { rootMargin: "0px 0px -8% 0px", threshold: 0 }
    );
  }
  return observer;
}

export default function Reveal({
  children,
  className,
  variant = "up",
  index = 0,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = ensureObserver();
    io.observe(el);
    return () => {
      io.unobserve(el);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      style={{ "--i": index } as React.CSSProperties}
      className={className}
    >
      {children}
    </Tag>
  );
}
