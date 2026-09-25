import { Checkbox, Label } from "raumplan-ui";

export const Default = () => (
  <div className="flex flex-col gap-3">
    <Label className="flex items-center gap-2">
      <Checkbox defaultChecked /> Keep existing sofa
    </Label>
    <Label className="flex items-center gap-2">
      <Checkbox /> Keep dining table
    </Label>
    <Label className="flex items-center gap-2">
      <Checkbox disabled /> Keep built-in wardrobe
    </Label>
  </div>
);

export const Invalid = () => (
  <Label className="flex items-center gap-2">
    <Checkbox aria-invalid /> I confirm the measurements are correct
  </Label>
);
