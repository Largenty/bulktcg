import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { routes } from "@/lib/routes";

/* Le gabarit d'un nouveau message : le fil d'Ariane, le titre, le champ, et
   à côté ce dont on parle — l'annonce ou la demande. */
export function NewMessageLayout({ title, aside, children }: { title: ReactNode; aside: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Breadcrumb items={[{ href: routes.inbox, label: "Messages" }, { label: "Nouveau message" }]} />
      <h1 className="display display-h2">{title}</h1>
      {/* Le champ d'abord, y compris sur téléphone : la fiche du lot le
          repoussait sous le premier écran, alors que le message pré-rempli
          nomme déjà le lot. Elle suit, pour vérifier avant d'envoyer. Dans
          le volet de droite de la messagerie, les deux colonnes attendent
          la largeur d'un très grand écran. */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="min-w-0">{children}</div>
        <aside>{aside}</aside>
      </div>
    </div>
  );
}
