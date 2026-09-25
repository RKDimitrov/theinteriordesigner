import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-foreground px-2 py-0.5 font-mono text-[10.5px] leading-4 font-medium tracking-[0.06em] whitespace-nowrap uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "bg-transparent text-foreground [a]:hover:bg-secondary",
        clay: "border-primary bg-transparent text-primary",
        olive: "border-olive bg-transparent text-olive",
        warn: "border-warn bg-transparent text-warn",
        destructive: "border-destructive bg-transparent text-destructive",
        ghost: "border-transparent hover:bg-secondary",
        link: "border-transparent tracking-normal normal-case underline underline-offset-3",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
