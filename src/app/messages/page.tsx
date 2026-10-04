import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

/* En grand écran, le volet de droite avant qu'un fil soit ouvert. Sur
   téléphone il n'est pas affiché : la liste occupe l'écran. */
export default function MessagesPage() {
  return (
    <div className="panel flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
      <Icon name="message" size={34} strokeWidth={1.6} className="text-[var(--muted)]" />
      <p className="display display-h3">Choisissez une conversation</p>
      <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
        Gardez les échanges ici : un numéro ou une adresse donnés trop tôt servent aussi aux arnaques. Le rendez-vous se
        fixe dans le fil, en lieu public.
      </p>
    </div>
  );
}
