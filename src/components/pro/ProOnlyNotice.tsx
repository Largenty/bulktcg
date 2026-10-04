import { ProBadge } from "@/components/pro/ProBadge";

/* Ce que voient le vendeur et les pros en tête d'une annonce réservée : où
   elle n'apparaît pas, et qui la voit. Le vendeur sait ainsi que son lien,
   collé dans un groupe, répondra « introuvable » aux particuliers. */
export function ProOnlyNotice() {
  return (
    <p className="notice mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-md)]">
      <ProBadge />
      <span>
        <strong className="font-semibold">Annonce réservée aux professionnels.</strong> Elle
        n&apos;apparaît ni dans la recherche publique ni sur Google : seuls son vendeur et les comptes
        pro au forfait actif la voient.
      </span>
    </p>
  );
}
