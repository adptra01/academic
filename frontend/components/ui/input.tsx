import * as React from "react";
import { cn } from "../../lib/utils";

const control =
  "w-full rounded-md border border-rule-2 bg-white px-2.5 text-[13px] text-ink transition-colors duration-200 placeholder:text-ink-4 hover:border-ink-4 focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-paper-2";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(control, "h-9", className)}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(control, "min-h-[64px] resize-y py-2 leading-relaxed", className)}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
