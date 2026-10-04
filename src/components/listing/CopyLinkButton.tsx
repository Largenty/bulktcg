"use client";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useCopyToClipboard } from "@/components/ui/useCopyToClipboard";

const MESSAGE = {
  idle: "Copier le lien",
  copied: "Lien copié",
  failed: "Copie impossible",
} as const;

type CopyLinkButtonProps = {
  url: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/* Le lien permanent est le produit : le copier doit coûter un clic, et le
   bouton dit ce qui s'est passé plutôt que de le laisser deviner. */
export function CopyLinkButton({ url, variant = "secondary", size = "md", className }: CopyLinkButtonProps) {
  const { status, copy } = useCopyToClipboard();

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant={variant} size={size} onClick={() => copy(url)} className={className}>
        <Icon name={status === "copied" ? "check" : "link"} size={size === "sm" ? 16 : 18} />
        {MESSAGE[status]}
      </Button>
      {/* La région reste dans l'arbre d'accessibilité même vide — sinon
          l'annonce ne partirait pas — mais hors du flux tant qu'elle n'a rien
          à dire, pour ne pas décaler les boutons voisins. */}
      <output
        aria-live="polite"
        className={status === "failed" ? "text-[length:var(--text-sm)] text-[var(--muted)]" : "sr-only"}
      >
        {status === "failed" ? "Sélectionnez le lien et copiez-le à la main." : ""}
      </output>
    </div>
  );
}
