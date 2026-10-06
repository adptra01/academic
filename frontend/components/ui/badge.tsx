import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * Badge = label status. Semua varian mengikuti token dan sengaja dibuat
 * terdesaturasi supaya tidak mencolok.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-medium uppercase leading-tight tracking-[0.1em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-rule bg-paper-2 text-ink-2",
        success: "border-accent-line bg-accent-wash text-accent-2",
        destructive: "border-danger/30 bg-danger/8 text-danger",
        info: "border-accent-line bg-accent-wash text-accent",
        warning: "border-warn/30 bg-warn-wash text-warn",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const alertVariants = cva("relative w-full rounded-md border px-3.5 py-2.5 text-[13px] leading-relaxed", {
  variants: {
    variant: {
      default: "border-rule bg-paper-2 text-ink-2",
      destructive: "border-danger/30 bg-danger/8 text-danger",
      success: "border-accent-line bg-accent-wash text-accent-2",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants, Alert };
