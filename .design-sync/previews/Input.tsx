import { Input, Label } from "raumplan-ui";

export const Default = () => (
  <div className="flex w-72 flex-col gap-1.5">
    <Label htmlFor="apt-name">Apartment name</Label>
    <Input id="apt-name" placeholder="e.g. Altbau Kreuzberg" />
  </div>
);

export const WithSuffix = () => (
  <div className="flex w-72 flex-col gap-1.5">
    <Label htmlFor="width">Room width</Label>
    <div className="relative">
      <Input id="width" type="number" defaultValue={420} className="pr-10" />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
        cm
      </span>
    </div>
    <p className="text-xs text-muted-foreground">Measured wall to wall.</p>
  </div>
);

export const Invalid = () => (
  <div className="flex w-72 flex-col gap-1.5">
    <Label htmlFor="height">Ceiling height</Label>
    <Input id="height" type="number" defaultValue={90} aria-invalid />
    <p className="text-xs text-destructive">Must be between 200 and 500 cm.</p>
  </div>
);

export const Disabled = () => <Input className="w-72" disabled defaultValue="Generated automatically" />;
