import type { ShopDetails as Shop } from "@/types/profile";
import { Icon } from "@/components/ui/Icon";
import { formatDate, formatSiret, formatWebsite } from "@/lib/format";
import { UNKNOWN_VALUE } from "@/lib/labels";

const LINK = "underline underline-offset-4 hover:text-[var(--chalk)]";

/* Une page de vendeur déclarée par la boutique : le lien, et ce qu'il est
   — rien ne prouve qu'elle est la sienne, la fiche ne le prétend pas. */
function DeclaredLink({ href, label }: { href: string | null; label: string }) {
  if (href === null) return UNKNOWN_VALUE;
  return (
    <>
      <a href={href} rel="nofollow ugc noopener" target="_blank" className={LINK}>
        {label}
      </a>{" "}
      <span className="text-[var(--chalk-muted)]">(déclaré par la boutique)</span>
    </>
  );
}

/* La fiche d'une boutique, sur l'ardoise de son profil : où la trouver,
   quand, en ligne, et qui elle est. Un champ que la boutique n'a pas
   rempli s'écrit « — » : il n'est pas deviné à partir du nom. Le SIRET et
   la raison sociale viennent du répertoire des entreprises, vérifiés quand
   la boutique a déclaré son statut ; ses pages Cardmarket et CardNexus sont
   déclarées, et dites telles. */
export function ShopDetails({ shop }: { shop: Shop }) {
  const rows = [
    { icon: "pin" as const, label: "Adresse", value: shop.address ?? UNKNOWN_VALUE },
    { icon: "clock" as const, label: "Horaires", value: shop.hours ?? UNKNOWN_VALUE },
    {
      icon: "external" as const,
      label: "Site",
      value: shop.website ? (
        <a href={shop.website} rel="nofollow ugc noopener" target="_blank" className={LINK}>
          {formatWebsite(shop.website)}
        </a>
      ) : (
        UNKNOWN_VALUE
      ),
    },
    {
      icon: "shield" as const,
      label: "SIRET",
      value: shop.verifiedAt ? (
        <>
          {formatSiret(shop.siret)}{" "}
          <span className="text-[var(--chalk-muted)]">
            (vérifié le <time dateTime={shop.verifiedAt}>{formatDate(shop.verifiedAt)}</time>)
          </span>
        </>
      ) : (
        formatSiret(shop.siret)
      ),
    },
    { icon: "user" as const, label: "Raison sociale", value: shop.legalName ?? UNKNOWN_VALUE },
    { icon: "link" as const, label: "Cardmarket", value: <DeclaredLink href={shop.cardmarketUrl} label="Page vendeur" /> },
    { icon: "link" as const, label: "CardNexus", value: <DeclaredLink href={shop.cardnexusUrl} label="Page vendeur" /> },
  ];

  return (
    <dl className="mt-5 grid gap-x-8 gap-y-3 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--slate-line)] p-4 sm:grid-cols-2">
      {/* Un groupe par ligne, fait de son seul dt et de son dd : l'icône vit
          dans le terme. Glissée entre la liste et ses termes, avec un <div>
          de plus, elle rendait la liste illisible aux lecteurs d'écran
          (WCAG 1.3.1). */}
      {rows.map((row) => (
        <div key={row.label} className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] gap-x-2.5">
          <dt className="label col-span-2 flex items-center gap-2.5 text-[var(--chalk-muted)]">
            <Icon name={row.icon} size={16} className="shrink-0" />
            {row.label}
          </dt>
          <dd className="col-start-2 mt-0.5 break-words text-[length:var(--text-md)] text-[var(--chalk-soft)]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
