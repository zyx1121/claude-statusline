import * as React from "react"

import { cn } from "@/lib/utils"

type Size = "sm" | "default" | "lg"

const sizes: Record<Size, string> = {
  sm: "rounded-lg p-4",
  default: "rounded-xl p-6",
  lg: "rounded-2xl p-8",
}

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: Size
}

export function Surface({
  className,
  size = "default",
  ...props
}: SurfaceProps) {
  return (
    <div
      data-slot="surface"
      className={cn("corner-token bg-block text-block-foreground", sizes[size], className)}
      {...props}
    />
  )
}
