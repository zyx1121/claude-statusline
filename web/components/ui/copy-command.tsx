import * as React from "react"

import { cn } from "@/lib/utils"
import { CopyButton } from "./copy-button"

export interface CopyCommandProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  prompt?: string
  copyLabel?: string
  multiline?: boolean
}

export function CopyCommand({
  value,
  prompt = "$",
  copyLabel,
  multiline = false,
  className,
  ...props
}: CopyCommandProps) {
  return (
    <div
      data-slot="copy-command"
      className={cn(
        "corner-token flex items-start gap-2 rounded-md bg-block pl-4 pr-2 text-sm",
        className,
      )}
      {...props}
    >
      <code
        className={cn(
          "min-w-0 flex-1 overflow-x-auto py-3 font-mono",
          multiline ? "whitespace-pre-wrap break-words" : "whitespace-nowrap",
        )}
      >
        {prompt ? (
          <span className="select-none text-foreground/50">{prompt} </span>
        ) : null}
        {value}
      </code>
      <CopyButton
        value={value}
        label={copyLabel ?? `Copy ${value}`}
        className="mt-1.5 shrink-0"
      />
    </div>
  )
}
