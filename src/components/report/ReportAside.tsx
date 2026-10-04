import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { routes } from "@/lib/routes";

/* À côté du formulaire de signalement : ce qu'il devient, et ce qu'on peut
   faire sans attendre. Rien de ce qui est écrit ici n'est une promesse que
   le site ne tient pas — la modération seule lit un signalement, le blocage
   vit dans la conversation. */
export function ReportAside() {
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="signalement-suite" className="panel">
        <h2 id="signalement-suite" className="label text-[var(--muted)]">
          Ce qui se passe ensuite
        </h2>
        <p className="mt-3 text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          Seule la modération lit un signalement, et la personne signalée n&apos;apprend pas qui l&apos;a
          fait. Il n&apos;engage rien d&apos;autre : pour ne plus être contacté, c&apos;est le blocage.
        </p>
      </section>

      <section aria-labelledby="signalement-attente" className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-[var(--tint)] p-5">
        <h2 id="signalement-attente" className="flex items-center gap-2 font-semibold">
          <Icon name="shield" size={20} />
          En attendant
        </h2>
        <ul className="flex list-none flex-col gap-2.5 text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          <li>Ne payez rien à distance : ni envoi, ni acompte.</li>
          <li>Gardez les échanges dans la messagerie du site.</li>
          <li>Depuis la conversation, bloquez la personne : elle ne pourra plus vous écrire, dans ce fil comme dans un autre.</li>
        </ul>
        <Link href={routes.safety} className="text-link text-[length:var(--text-md)] text-[var(--ink)]">
          Conseils de sécurité
        </Link>
      </section>
    </div>
  );
}
