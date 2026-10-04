import type { ComponentPropsWithoutRef } from "react";
import { Field } from "@/components/ui/Field";

type TextareaProps = Omit<ComponentPropsWithoutRef<"textarea">, "id" | "className"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  isRequired?: boolean;
  hasOptionalHint?: boolean;
};

export function Textarea({
  id,
  label,
  hint,
  error,
  isRequired = false,
  hasOptionalHint = true,
  rows = 7,
  ...rest
}: TextareaProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      isRequired={isRequired}
      hasOptionalHint={hasOptionalHint}
    >
      <textarea
        id={id}
        name={rest.name ?? id}
        rows={rows}
        required={isRequired}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="field resize-y leading-relaxed"
        {...rest}
      />
    </Field>
  );
}
