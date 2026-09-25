import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

// The ink box: border, sheet fill, clay offset on focus, red border when invalid.
const inputBox =
  "border-[1.5px] border-input bg-card shadow-[inset_0_-2px_0_rgba(43,38,34,.06)] transition-shadow"

const inputField =
  "w-full min-w-0 px-3 py-2.5 text-[15px] leading-5 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-mono file:text-xs file:text-foreground file:uppercase placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&[type=number]]:font-mono [&[type=number]]:tabular-nums"

function Input({
  className,
  type,
  unit,
  ...props
}: React.ComponentProps<"input"> & {
  /** Short unit shown inside the box on the right, e.g. "cm". */
  unit?: React.ReactNode
}) {
  if (unit == null) {
    return (
      <InputPrimitive
        type={type}
        data-slot="input"
        className={cn(
          inputBox,
          inputField,
          "focus-visible:shadow-offset-clay aria-invalid:border-destructive",
          className
        )}
        {...props}
      />
    )
  }

  return (
    <div
      data-slot="input-group"
      className={cn(
        inputBox,
        "flex w-full min-w-0 items-center focus-within:shadow-offset-clay has-aria-invalid:border-destructive",
        className
      )}
    >
      <InputPrimitive
        type={type}
        data-slot="input"
        className={cn(inputField, "bg-transparent")}
        {...props}
      />
      <span
        data-slot="input-unit"
        className="pr-3 font-mono text-xs text-muted-foreground select-none"
      >
        {unit}
      </span>
    </div>
  )
}

export { Input }
