import { Label, Textarea } from "raumplan-ui";

export const Default = () => (
  <div className="flex w-80 flex-col gap-1.5">
    <Label htmlFor="notes">Anything we should know?</Label>
    <Textarea id="notes" placeholder="e.g. we work from home two days a week and have a large dog" />
  </div>
);

export const Filled = () => (
  <Textarea
    className="w-80"
    defaultValue="Keep the grandmother's cabinet in the hallway. Prefer natural materials, no glossy surfaces."
  />
);

export const Invalid = () => (
  <div className="flex w-80 flex-col gap-1.5">
    <Textarea aria-invalid placeholder="Describe your style" />
    <p className="text-xs text-destructive">Please describe your style in at least 10 characters.</p>
  </div>
);
