"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

// Atelier toggle: square ink track and knob; on = clay track, sheet knob.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-[46px] shrink-0 cursor-pointer items-center border-[1.5px] border-foreground bg-card transition-colors outline-none focus-visible:shadow-offset-clay disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 translate-x-[2px] bg-foreground transition-[translate,background-color] duration-150 data-checked:translate-x-[24px] data-checked:bg-card"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
