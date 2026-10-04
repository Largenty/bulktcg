import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { routes } from "@/lib/routes";

/* Rappelé sur chaque fiche, parce que c'est là que l'arnaque se tente :
   « je vous l'envoie si vous payez d'abord ». Ici, rien ne s'envoie. */
export function SafetyNote() {
  return (
    <div className="flex gap-3 rounded-[var(--radius-lg)] bg-[var(--tint)] p-4">
      <Icon name="shield" size={22} className="mt-0.5 shrink-0" />
      <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
        <strong className="font-semibold text-[var(--ink)]">Remise en main propre uniquement.</strong> Aucun
        envoi, aucun paiement à distance, aucun acompte.{" "}
        <Link href={routes.safety} className="text-link text-[var(--ink)]">
          Conseils de transaction
        </Link>
      </p>
    </div>
  );
}
