import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Field } from "@/components/ui/Field";

type InputProps = Omit<ComponentPropsWithoutRef<"input">, "id" | "className"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  isRequired?: boolean;
  hasOptionalHint?: boolean;
  suffix?: string;
  /* Un contrôle posé dans le champ, à droite — le bouton qui affiche un mot
     de passe. Il reste un élément à part, atteignable au clavier. */
  trailing?: ReactNode;
};

export function Input({
  id,
  label,
  hint,
  error,
  isRequired = false,
  hasOptionalHint = true,
  suffix,
  trailing,
  ...rest
}: InputProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      isRequired={isRequired}
      hasOptionalHint={hasOptionalHint}
    >
      <div className="relative">
        <input
          id={id}
          name={rest.name ?? id}
          required={isRequired}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={["field", suffix ? "pr-12" : null, trailing ? "pr-28" : null].filter(Boolean).join(" ")}
          {...rest}
        />
        {trailing ? <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span> : null}
        {suffix ? (
          <span className="mono pointer-events-none absolute inset-y-0 right-4 flex items-center text-[length:var(--text-md)] text-[var(--muted)]">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}
