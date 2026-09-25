import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border-[1.5px] border-foreground bg-clip-padding font-mono text-xs leading-4 font-medium tracking-[0.08em] whitespace-nowrap uppercase shadow-offset transition-[translate,box-shadow,background-color] duration-120 outline-none select-none hover:-translate-x-px hover:-translate-y-px hover:shadow-offset-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:not-aria-[haspopup]:translate-x-0.5 active:not-aria-[haspopup]:translate-y-0.5 active:not-aria-[haspopup]:shadow-offset-sm disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-pressed:bg-foreground aria-pressed:text-card data-pressed:bg-foreground data-pressed:text-card [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground active:not-aria-[haspopup]:bg-clay-dark",
        outline: "bg-card text-foreground aria-expanded:bg-accent",
        secondary: "bg-card text-foreground aria-expanded:bg-accent",
        ghost:
          "border-dashed bg-transparent text-foreground shadow-none hover:translate-0 hover:bg-card hover:shadow-none active:not-aria-[haspopup]:translate-0 active:not-aria-[haspopup]:shadow-none aria-expanded:bg-card",
        "ghost-destructive":
          "border-dashed border-destructive bg-transparent text-destructive shadow-none hover:translate-0 hover:bg-card hover:shadow-none active:not-aria-[haspopup]:translate-0 active:not-aria-[haspopup]:shadow-none",
        destructive: "border-destructive bg-card text-destructive",
        link: "h-auto! border-transparent p-0! tracking-normal normal-case underline underline-offset-3 shadow-none hover:translate-0 hover:text-primary hover:shadow-none active:not-aria-[haspopup]:translate-0 active:not-aria-[haspopup]:shadow-none",
      },
      size: {
        default:
          "px-4 py-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "gap-1 px-2 py-1 text-[10px] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "gap-1.5 px-3 py-[7px] text-[11px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "px-5 py-3 text-[13px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
