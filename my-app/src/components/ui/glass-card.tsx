import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export function GlassCard({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "liquid-glass rounded-xl p-5 shadow-[var(--shadow-glass)] flex flex-col justify-between group hover:border-slate-300 :border-slate-600 transition-colors",
        className,
      )}
      {...props}
    />
  );
}
