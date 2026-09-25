"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "@/lib/utils"

interface SegmentedProps<T extends string> {
  value: T
  options: readonly { value: T; label: string; disabled?: boolean }[]
  onChange: (value: T) => void
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}

/** Segmented control: 1.5px ink box, mono options split by ink lines, active one ink-filled. */
function Segmented<T extends string>({ value, options, onChange, className, ...aria }: SegmentedProps<T>) {
  return (
    <RadioGroupPrimitive
      data-slot="segmented"
      value={value}
      onValueChange={(v) => {
        const next = options.find((o) => o.value === v)
        if (next) onChange(next.value)
      }}
      className={cn("inline-flex w-fit max-w-full border-[1.5px] border-foreground bg-card", className)}
      {...aria}
    >
      {options.map((o) => (
        <RadioPrimitive.Root
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="cursor-pointer data-disabled:cursor-not-allowed data-disabled:text-muted-foreground data-disabled:hover:bg-transparent border-r border-foreground px-3.5 py-2 text-center font-mono text-[11.5px] font-medium tracking-[0.08em] whitespace-nowrap uppercase outline-none select-none last:border-r-0 hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring data-checked:bg-foreground data-checked:text-card"
        >
          {o.label}
        </RadioPrimitive.Root>
      ))}
    </RadioGroupPrimitive>
  )
}

export { Segmented }
