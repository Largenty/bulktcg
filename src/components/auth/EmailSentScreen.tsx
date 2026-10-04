import type { ReactNode } from "react";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { ButtonLink } from "@/components/ui/Button";

export type EmailSentAction = { href: string; label: string };

type EmailSentScreenProps = {
  /* L'adresse montrée à demi (« l•••@gmail.com »), ou null : elle n'est
     connue que de la page qui suit l'envoi, et seulement dix minutes. */
  maskedEmail: string | null;
  /* Ce qui vient de partir, dit sans affirmer qu'un compte existe : la
     phrase reçoit l'adresse, ou « l'adresse saisie ». */
  sentence: (address: ReactNode) => ReactNode;
  /* Quoi faire s'il n'arrive pas, dans l'ordre où on le fait. */
  advice: readonly string[];
  /* Les gestes, à droite : recommencer, se connecter. */
  actions: readonly EmailSentAction[];
  /* Site de démonstration : ce qui ne part pas, dit en tête. null sinon. */
  demoNote: string | null;
};

/* La page qui suit une inscription ou une demande de nouveau mot de passe.
   Sans elle, la réponse tenait sous le bouton, et la personne croyait que
   rien ne s'était passé. Elle dit ce qui part, combien de temps attendre,
   où chercher, et quoi faire sinon — en des termes vrais que l'adresse ait
   un compte ou non, puisque la page n'en sait rien de plus que le
   formulaire ne doit en dire. */
export function EmailSentScreen({ maskedEmail, sentence, advice, actions, demoNote }: EmailSentScreenProps) {
  const address = maskedEmail === null ? "l'adresse saisie" : <strong className="mono font-semibold text-[var(--ink)]">{maskedEmail}</strong>;

  return (
    <AuthPageLayout
      title="Vérifiez vos e-mails"
      form={
        <div className="panel flex flex-col gap-3">
          {actions.map((action) => (
            <ButtonLink key={action.href} href={action.href} variant="secondary" size="lg">
              {action.label}
            </ButtonLink>
          ))}
        </div>
      }
    >
      {demoNote === null ? null : (
        <p className="notice notice-warn mt-5 text-[length:var(--text-md)] leading-relaxed text-[var(--ink)]">{demoNote}</p>
      )}
      <p className="lead mt-5 text-[var(--ink-soft)]">{sentence(address)}</p>
      <ol className="mt-6 grid list-none gap-3">
        {advice.map((item, index) => (
          <li
            key={item}
            className="flex gap-3 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-4 text-[length:var(--text-md)] leading-relaxed"
          >
            <span aria-hidden="true" className="mono shrink-0 text-[var(--muted)]">
              {index + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>
    </AuthPageLayout>
  );
}
