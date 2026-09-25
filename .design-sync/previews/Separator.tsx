import { Separator } from "raumplan-ui";

export const Horizontal = () => (
  <div className="w-72 text-sm">
    <p className="font-medium">Living room</p>
    <p className="text-muted-foreground">24.5 m² · south-facing</p>
    <Separator className="my-3" />
    <p className="font-medium">Bedroom</p>
    <p className="text-muted-foreground">14.2 m² · east-facing</p>
  </div>
);

export const Vertical = () => (
  <div className="flex h-5 items-center gap-3 text-sm">
    <span>Plan</span>
    <Separator orientation="vertical" />
    <span>Design</span>
    <Separator orientation="vertical" />
    <span>Budget</span>
  </div>
);
