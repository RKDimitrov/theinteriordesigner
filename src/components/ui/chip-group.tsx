"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "@/lib/utils"

/** Chip look shared by single- and multi-select chip rows: mono label, ink box, ink fill + clay offset when on. */
const chipClass =
  "cursor-pointer border-[1.5px] border-foreground bg-card px-3.5 py-2 font-mono text-xs font-medium tracking-[0.06em] whitespace-nowrap uppercase outline-none select-none transition-[box-shadow,background-color] hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:bg-foreground data-checked:text-card data-checked:shadow-offset-clay aria-pressed:bg-foreground aria-pressed:text-card aria-pressed:shadow-offset-clay"

interface ChipGroupProps<T extends string> {
  value: T
  options: readonly { value: T; label: string; disabled?: boolean; testId?: string }[]
  onChange: (value: T) => void
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}

/** Single-select row of chips (a radio group). */
function ChipGroup<T extends string>({ value, options, onChange, className, ...aria }: ChipGroupProps<T>) {
  return (
    <RadioGroupPrimitive
      data-slot="chip-group"
      value={value}
      onValueChange={(v) => {
        const next = options.find((o) => o.value === v)
        if (next) onChange(next.value)
      }}
      className={cn("flex flex-wrap gap-2", className)}
      {...aria}
    >
      {options.map((o) => (
        <RadioPrimitive.Root key={o.value} value={o.value} disabled={o.disabled} data-testid={o.testId} className={chipClass}>
          {o.label}
        </RadioPrimitive.Root>
      ))}
    </RadioGroupPrimitive>
  )
}

export { ChipGroup, chipClass }
