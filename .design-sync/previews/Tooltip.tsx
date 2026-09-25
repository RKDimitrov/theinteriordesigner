import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "raumplan-ui";

export const Open = () => (
  <TooltipProvider>
    <div className="flex h-32 w-72 items-end justify-center">
      <Tooltip defaultOpen>
        <TooltipTrigger render={<Button variant="outline" />}>Regenerate</TooltipTrigger>
        <TooltipContent>Creates a new layout with the same style profile</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
);
