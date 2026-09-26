import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// A rubber stamp: done (olive), in progress (dashed clay), warning, error.
const stampVariants = cva(
  "inline-grid shrink-0 place-items-center rounded-full border-2 text-center font-mono leading-[1.1] font-semibold tracking-[0.08em] uppercase opacity-85 select-none",
  {
    variants: {
      tone: {
        done: "-rotate-14 border-olive text-olive",
        progress: "rotate-9 border-dashed border-primary text-primary",
        warn: "-rotate-14 border-warn text-warn",
        error: "-rotate-14 border-destructive text-destructive",
      },
      size: {
        default: "size-[62px] text-[10px]",
        lg: "size-24 border-[2.5px] text-[13px]",
      },
    },
    defaultVariants: {
      tone: "done",
      size: "default",
    },
  }
)

function Stamp({
  className,
  tone,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof stampVariants>) {
  return (
    <span
      data-slot="stamp"
      data-tone={tone ?? "done"}
      className={cn(stampVariants({ tone, size }), className)}
      {...props}
    />
  )
}

export { Stamp, stampVariants }
