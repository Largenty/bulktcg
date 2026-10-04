import { AD_DISCLOSURE, AD_FORMATS, type AdFormat } from "@/lib/ads";

type AdSlotProps = {
  format: AdFormat;
  /* Sert au ciblage de la régie et au repérage dans les journaux. */
  slotId: string;
  className?: string;
};

/* Emplacement publicitaire. La hauteur est réservée dès le rendu serveur,
   avant tout chargement : sans ça la pub pousse le contenu au moment où elle
   arrive, et l'acheteur clique sur autre chose que ce qu'il visait.
   Un <aside> et jamais un <article> : un encart déguisé en vignette
   tromperait l'acheteur. La mention « Publicité » est toujours visible. */
export function AdSlot({ format, slotId, className }: AdSlotProps) {
  const spec = AD_FORMATS[format];

  return (
    /* Le nom porte le format : le bandeau et le pavé d'une même page
       s'appelaient tous deux « Publicité », deux repères indiscernables. La
       mention visible, elle, reste « Publicité ». */
    <aside
      aria-label={`${AD_DISCLOSURE} — ${spec.label}`}
      data-ad-slot={slotId}
      className={["flex w-full flex-col items-center gap-1.5", className].filter(Boolean).join(" ")}
    >
      <span className="label self-center text-[var(--muted)]">{AD_DISCLOSURE}</span>
      <div
        className="ad-slot relative flex items-center justify-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] bg-[var(--tint)]"
        style={
          {
            "--ad-width": spec.width,
            "--ad-height": spec.height,
            "--ad-mobile-width": spec.mobileWidth,
            "--ad-mobile-height": spec.mobileHeight,
          } as React.CSSProperties
        }
      >
        <span className="mono text-[length:var(--text-xs)] text-[var(--muted)]">
          {spec.label} {spec.width}×{spec.height}
        </span>
      </div>
    </aside>
  );
}
