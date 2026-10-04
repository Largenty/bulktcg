import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* primary : l'action de la page, encre pleine.
   secondary : l'alternative, contour et fond blanc.
   quiet : un geste de service, sans contour.
   inverse / outline-inverse : les mêmes rôles posés sur l'ardoise.
   danger : la suppression, et seulement au second temps de la confirmation. */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "inverse"
  | "outline-inverse"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "",
  secondary: "btn-secondary",
  quiet: "btn-quiet",
  inverse: "btn-inverse",
  "outline-inverse": "btn-outline-inverse",
  danger: "btn-danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return ["btn", VARIANT_CLASS[variant], SIZE_CLASS[size], extra].filter(Boolean).join(" ");
}

/* ComponentProps et non ComponentPropsWithoutRef : en React 19 la ref est
   une prop ordinaire, et un bouton doit pouvoir recevoir le focus au montage
   — c'est ce dont vit la confirmation de suppression. */
type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClassName(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClassName(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
