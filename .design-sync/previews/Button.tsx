import { Button } from "raumplan-ui";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>Generate design</Button>
    <Button variant="secondary">Save draft</Button>
    <Button variant="outline">Edit floor plan</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="destructive">Delete apartment</Button>
    <Button variant="link">View trends</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button>Default</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button disabled>Generating…</Button>
    <Button variant="outline" disabled>
      Edit floor plan
    </Button>
  </div>
);
