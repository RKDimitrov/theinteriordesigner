import { Label, Slider } from "raumplan-ui";

export const Default = () => (
  <div className="flex w-72 flex-col gap-3">
    <div className="flex items-center justify-between">
      <Label>Warmth</Label>
      <span className="text-sm text-muted-foreground">60%</span>
    </div>
    <Slider defaultValue={[60]} />
  </div>
);

export const Range = () => (
  <div className="flex w-72 flex-col gap-3">
    <div className="flex items-center justify-between">
      <Label>Price per item</Label>
      <span className="text-sm text-muted-foreground">€200 – €1,200</span>
    </div>
    <Slider defaultValue={[200, 1200]} min={0} max={2000} step={50} />
  </div>
);

export const Disabled = () => (
  <div className="w-72">
    <Slider defaultValue={[30]} disabled />
  </div>
);
