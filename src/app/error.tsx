"use client";

import { useEffect } from "react";
import { WayOut } from "@/components/layout/WayOut";
import { Button, ButtonLink } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

/* Le pendant nécessaire d'un choix pris ailleurs : lib/data/mappers.ts lève
   quand une valeur d'énumération ou une série est inconnue, plutôt que de
   servir une annonce à l'état « undefined ». C'est la bonne décision, mais
   sans cet écran elle rendait la page blanche de Next — et en phase 2, une
   dérive de schéma est précisément le moment où il faut dire clairement ce
   qui se passe.

   Le texte ne prétend pas savoir : il dit qu'une donnée a été refusée, pas
   qu'elle était fausse, et il propose de réessayer avant de partir. */
export default function ErrorScreen({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    /* Phase 2 : ce point est celui où l'erreur part vers la supervision.
       En attendant, elle va dans la console du navigateur plutôt que nulle
       part — une erreur avalée en silence est une erreur qu'on découvre
       par un utilisateur. */
    console.error(error);
  }, [error]);

  return (
    <div className="container pb-[var(--section-gap)] pt-10 lg:pt-16">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-start lg:gap-14">
        <div>
          <p className="eyebrow text-[var(--muted)]">Erreur</p>
          <h1 className="display display-h1 mt-3">Page interrompue</h1>
          <p className="lead mt-6 text-[var(--ink-soft)]">
            Une donnée de cette page n&apos;a pas pu être lue, et le site préfère s&apos;arrêter
            plutôt que d&apos;afficher une annonce dont un champ serait faux — un prix, un état ou
            une série valent mieux absents qu&apos;inventés.
          </p>
          <p className="mt-4 text-[length:var(--text-md)] leading-relaxed text-[var(--muted)]">
            Les autres pages fonctionnent normalement. Si le problème revient sur cette page-là
            seulement, c&apos;est l&apos;annonce qu&apos;elle affiche qui est en cause.
          </p>

          {error.digest ? (
            <p className="mono mt-6 text-[length:var(--text-xs)] text-[var(--muted)]">
              Référence de l&apos;incident : {error.digest}
            </p>
          ) : null}

          <div className="mt-9 flex flex-wrap gap-3">
            {/* retry() relit les données et refait le rendu ; reset() ne
                faisait qu'effacer l'erreur, et une base indisponible
                retombait à l'identique au premier clic. */}
            <Button onClick={retry}>Réessayer</Button>
            <ButtonLink href={routes.listings} variant="secondary">
              Voir les annonces
            </ButtonLink>
          </div>
        </div>
        {/* Les autres pages fonctionnent : la colonne d'à côté y mène. */}
        <WayOut />
      </div>
    </div>
  );
}
