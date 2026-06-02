import * as React from "react"

import { cn } from "@/lib/utils"

type Size = "sm" | "default" | "lg"

const sizes: Record<Size, string> = {
  sm: "rounded-lg",
  default: "rounded-xl",
  lg: "rounded-2xl",
}

export interface TerminalSurfaceProps
  extends React.HTMLAttributes<HTMLDivElement> {
  size?: Size
}

export function TerminalSurface({
  className,
  size = "default",
  ...props
}: TerminalSurfaceProps) {
  return (
    <div
      data-slot="terminal-surface"
      className={cn(
        "corner-superellipse bg-[#0c0d12] text-neutral-300 ring-1 ring-white/10",
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
