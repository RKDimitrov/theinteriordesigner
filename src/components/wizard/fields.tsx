"use client";

import { useId, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, error, className, children }: FieldShellProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
  error?: string;
  className?: string;
  /** Allow an empty value (reported as null). */
  optional?: boolean;
}

/**
 * Numeric input that keeps the raw text while typing and only reports
 * valid numbers upwards (empty -> null when optional).
 */
export function NumberField({ label, value, onChange, min, max, step = 1, suffix, hint, error, className, optional }: NumberFieldProps) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [prevValue, setPrevValue] = useState(value);

  // Sync when the value changes from outside (e.g. dragging on the canvas),
  // but keep partial input like "12." that already represents the value.
  if (value !== prevValue) {
    setPrevValue(value);
    if (text === "" || Number(text) !== value) setText(value === null ? "" : String(value));
  }

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => (
        <div className="relative">
          <Input
            id={id}
            inputMode="decimal"
            type="number"
            min={min}
            max={max}
            step={step}
            value={text}
            aria-invalid={error ? true : undefined}
            className={suffix ? "pr-10" : undefined}
            onChange={(e) => {
              const raw = e.target.value;
              setText(raw);
              if (raw.trim() === "") {
                if (optional) onChange(null);
                return;
              }
              const n = Number(raw);
              if (Number.isFinite(n)) onChange(n);
            }}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span>
          )}
        </div>
      )}
    </Field>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
  error?: string;
  className?: string;
}

export function SelectField<T extends string>({ label, value, options, onChange, hint, error, className }: SelectFieldProps<T>) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => (
        <select
          id={id}
          value={value}
          onChange={(e) => {
            const next = options.find((o) => o.value === e.target.value);
            if (next) onChange(next.value);
          }}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  className?: string;
  maxLength?: number;
}

export function TextField({ label, value, onChange, placeholder, hint, error, className, maxLength }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
