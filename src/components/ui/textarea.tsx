import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full border-[1.5px] border-input bg-card px-3 py-2.5 text-[15px] shadow-[inset_0_-2px_0_rgba(43,38,34,.06)] transition-shadow outline-none placeholder:text-muted-foreground focus-visible:shadow-offset-clay disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
