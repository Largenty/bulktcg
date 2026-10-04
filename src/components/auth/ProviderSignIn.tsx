import { GoogleMark } from "@/components/auth/GoogleMark";
import { Button } from "@/components/ui/Button";

/* Le fournisseur en premier : c'est le chemin le plus court, et celui qui
   évite un mot de passe de plus à retenir. Désactivé tant que Google n'est
   pas branché dans Supabase Auth — il n'a pas de formulaire à valider en
   attendant, lui —, et il le dit. */
export function ProviderSignIn({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Button type="button" variant="secondary" size="lg" disabled aria-describedby="provider-note" className="w-full">
        <GoogleMark />
        {label}
      </Button>
      <p id="provider-note" className="text-[length:var(--text-sm)] leading-relaxed text-[var(--muted)]">
        La connexion par Google n&apos;est pas encore ouverte.
      </p>
      <p className="label flex items-center gap-4 text-[var(--muted)]">
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--line)]" />
        ou par e-mail
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--line)]" />
      </p>
    </div>
  );
}
