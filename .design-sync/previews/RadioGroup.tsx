import { Label, RadioGroup, RadioGroupItem } from "raumplan-ui";

export const Default = () => (
  <RadioGroup defaultValue="couple">
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="single" /> Living alone
    </Label>
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="couple" /> Couple
    </Label>
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="family" /> Family with children
    </Label>
  </RadioGroup>
);

export const Disabled = () => (
  <RadioGroup defaultValue="rent" disabled>
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="rent" /> Rented
    </Label>
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="own" /> Owned
    </Label>
  </RadioGroup>
);
