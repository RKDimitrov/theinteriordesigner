import { Label, RadioGroup, RadioGroupItem } from "raumplan-ui";

export const InGroup = () => (
  <RadioGroup defaultValue="north" className="flex flex-row gap-4">
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="north" /> North
    </Label>
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="south" /> South
    </Label>
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="east" /> East
    </Label>
  </RadioGroup>
);
