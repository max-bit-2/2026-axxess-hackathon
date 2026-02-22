import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

export function GlassCard({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "glass-panel rounded-[28px] border border-white/45 p-5 shadow-[0_18px_45px_-28px_rgba(12,40,75,0.58)]",
        className,
      )}
      {...props}
    />
  );
}
