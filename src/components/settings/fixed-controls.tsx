"use client";

import { useId } from "react";
import { fieldLabelClass } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";

/**
 * Segmented control for a preference that has only one supported value today.
 * The other options are shown, disabled, so people can see what is coming.
 */
export function FixedChoice({ label, value, options }: { label: string; value: string; options: readonly { value: string; label: string }[] }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className={fieldLabelClass}>
        {label}
      </span>
      <Segmented aria-labelledby={id} value={value} onChange={() => {}} options={options.map((o) => ({ ...o, disabled: o.value !== value }))} />
    </div>
  );
}

/** Read-only toggle that shows how a designer rule currently behaves. */
export function FixedToggle({ label, hint, checked }: { label: string; hint: string; checked: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-5 py-1.5">
      <div>
        <label htmlFor={id} className="text-[15px]">
          {label}
        </label>
        <p className="text-[12.5px] text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} disabled />
    </div>
  );
}
