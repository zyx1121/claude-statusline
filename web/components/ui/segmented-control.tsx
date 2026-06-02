"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SegmentedControlOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: SegmentedControlOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  ariaLabel?: string
}

export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  className,
  ...props
}: SegmentedControlProps) {
  const firstEnabled = options.find((option) => !option.disabled)?.value
  const [internalValue, setInternalValue] = React.useState(
    defaultValue ?? firstEnabled ?? "",
  )
  const selectedValue = value ?? internalValue

  const select = (nextValue: string) => {
    setInternalValue(nextValue)
    onValueChange?.(nextValue)
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-slot="segmented-control"
      className={cn(
        "corner-token inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-block p-1",
        className,
      )}
      {...props}
    >
      {options.map((option) => {
        const selected = option.value === selectedValue

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={option.disabled}
            className={cn(
              "h-8 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "bg-background text-foreground"
                : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
            )}
            onClick={() => select(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
