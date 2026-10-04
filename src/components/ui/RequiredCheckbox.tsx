import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";

type RequiredCheckboxProps = Omit<ComponentPropsWithoutRef<typeof Checkbox>, "required"> & {
  error?: string;
  description?: ReactNode;
};

/* Une case qui engage — une déclaration, un consentement — et que le
   formulaire refuse sans elle. Le refus s'écrit sous la case, comme sous un
   champ (Field), et la case le désigne aux lecteurs d'écran. */
export function RequiredCheckbox({ id, error, ...rest }: RequiredCheckboxProps) {
  return (
    <div className="flex flex-col gap-2">
      <Checkbox id={id} required aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...rest} />
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--danger)]">
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
