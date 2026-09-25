import { Input, Label } from "raumplan-ui";

export const Default = () => (
  <div className="flex w-72 flex-col gap-1.5">
    <Label htmlFor="budget">Total budget</Label>
    <Input id="budget" placeholder="5,000 €" />
  </div>
);
