"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-4 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-stretch group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      // default: segmented control. line: nav-style clay underline.
      // folder: large serif file tabs sitting on a 1.5px ink rule.
      variant: {
        default: "border-[1.5px] border-foreground bg-card",
        line: "gap-5 bg-transparent",
        folder:
          "w-full gap-1 border-b-[1.5px] border-foreground bg-transparent group-data-vertical/tabs:border-r-[1.5px] group-data-vertical/tabs:border-b-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-foreground transition-colors outline-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // segmented
        "group-data-[variant=default]/tabs-list:flex-1 group-data-[variant=default]/tabs-list:px-3.5 group-data-[variant=default]/tabs-list:py-2 group-data-[variant=default]/tabs-list:font-mono group-data-[variant=default]/tabs-list:text-[11.5px] group-data-[variant=default]/tabs-list:font-medium group-data-[variant=default]/tabs-list:tracking-[0.08em] group-data-[variant=default]/tabs-list:uppercase group-data-[variant=default]/tabs-list:not-last:border-r group-data-[variant=default]/tabs-list:not-last:border-foreground group-data-vertical/tabs:group-data-[variant=default]/tabs-list:not-last:border-r-0 group-data-vertical/tabs:group-data-[variant=default]/tabs-list:not-last:border-b group-data-[variant=default]/tabs-list:hover:bg-secondary group-data-[variant=default]/tabs-list:data-active:bg-foreground group-data-[variant=default]/tabs-list:data-active:text-card",
        // line
        "group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:pb-[3px] group-data-[variant=line]/tabs-list:font-mono group-data-[variant=line]/tabs-list:text-xs group-data-[variant=line]/tabs-list:font-medium group-data-[variant=line]/tabs-list:tracking-[0.08em] group-data-[variant=line]/tabs-list:uppercase group-data-[variant=line]/tabs-list:hover:border-rule group-data-[variant=line]/tabs-list:data-active:border-primary",
        // folder
        "group-data-[variant=folder]/tabs-list:top-1 group-data-[variant=folder]/tabs-list:-mb-[1.5px] group-data-[variant=folder]/tabs-list:border-[1.5px] group-data-[variant=folder]/tabs-list:border-b-0 group-data-[variant=folder]/tabs-list:border-foreground group-data-[variant=folder]/tabs-list:bg-secondary group-data-[variant=folder]/tabs-list:px-5 group-data-[variant=folder]/tabs-list:pt-2.5 group-data-[variant=folder]/tabs-list:pb-2 group-data-[variant=folder]/tabs-list:font-heading group-data-[variant=folder]/tabs-list:text-[26px] group-data-[variant=folder]/tabs-list:leading-none group-data-[variant=folder]/tabs-list:data-active:top-0 group-data-[variant=folder]/tabs-list:data-active:bg-card group-data-[variant=folder]/tabs-list:data-active:pb-3",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
