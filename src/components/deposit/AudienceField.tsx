import type { ListingAudience } from "@/types/listing";
import { ProBadge } from "@/components/pro/ProBadge";
import { AUDIENCE_LABELS } from "@/lib/labels";

type AudienceFieldProps = {
  defaultValue?: string;
  error?: string;
};

const OPTIONS: Array<{ value: ListingAudience; description: string }> = [
  {
    value: "everyone",
    description:
      "Recherche, pages de jeu et de ville, Google : l'annonce se voit partout. Le plus d'acheteurs possible.",
  },
  {
    value: "pros",
    description:
      "Seules les boutiques au forfait pro la voient, ni la recherche publique ni Google. Pour vendre vite un gros lot à un acheteur qui connaît les prix.",
  },
];

/* Qui voit l'annonce. Deux cartes à choix unique : le bouton radio natif
   reste dans le DOM — il porte l'état, le clavier et la soumission — et la
   carte entière est sa cible. Le formulaire lit ce champ comme les autres :
   l'aperçu suit le choix sans qu'on ait à le lui transmettre. */
export function AudienceField({ defaultValue = "everyone", error }: AudienceFieldProps) {
  return (
    <fieldset aria-describedby={error ? "audience-error" : "audience-hint"} className="flex flex-col gap-3">
      <legend className="sr-only">Qui peut voir l&apos;annonce</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer gap-3 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--ink)] has-[:checked]:border-[length:var(--border-width-strong)] has-[:checked]:border-[var(--ink)] has-[:focus-visible]:outline has-[:focus-visible]:outline-[length:var(--border-width-strong)] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ink)]"
          >
            <input
              /* Le premier bouton porte l'identifiant du champ : c'est lui
                 que reçoit le focus quand la validation signale une erreur. */
              id={option.value === "everyone" ? "audience" : undefined}
              type="radio"
              name="audience"
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-[length:var(--border-width-strong)] border-[var(--line-strong)] peer-checked:border-[var(--ink)] peer-checked:[&>span]:scale-100"
            >
              <span className="h-2.5 w-2.5 scale-0 rounded-full bg-[var(--ink)] transition-transform" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-2 font-semibold">
                {AUDIENCE_LABELS[option.value]}
                {option.value === "pros" ? <ProBadge /> : null}
              </span>
              <span className="text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p id="audience-error" className="text-[length:var(--text-sm)] font-semibold text-[var(--danger)]">
          {error}
        </p>
      ) : (
        <p id="audience-hint" className="text-[length:var(--text-sm)] text-[var(--muted)]">
          Vous pourrez changer d&apos;avis à tout moment : le lien de l&apos;annonce reste le même.
        </p>
      )}
    </fieldset>
  );
}
