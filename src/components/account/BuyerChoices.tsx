/* Quelqu'un qui a écrit à propos du lot : c'est parmi eux que se désigne
   l'acheteur, jamais un pseudo tapé à la main. */
export type BuyerCandidate = { conversationId: string; userId: string; username: string };

/* « Quelqu'un d'autre, hors BulkTCG » : un choix qui ne désigne personne. */
export const ELSEWHERE = "elsewhere";

/* Le choix proposé d'emblée : la première personne qui a écrit, ou
   « ailleurs » quand personne n'a écrit. */
export function firstBuyerChoice(buyers: BuyerCandidate[]): string {
  return buyers[0]?.conversationId ?? ELSEWHERE;
}

type BuyerChoicesProps = {
  name: string;
  buyers: BuyerCandidate[];
  /* Ce que le choix implique : pour une personne qui a écrit, et pour
     quelqu'un d'autre. */
  notes: { buyer: string; elsewhere: string };
  value: string;
  onChange: (value: string) => void;
};

/* Les personnes qui ont écrit à propos du lot, en boutons radio, puis
   « Quelqu'un d'autre ». Réserver et clôturer une vente désignent la
   personne de la même façon. */
export function BuyerChoices({ name, buyers, notes, value, onChange }: BuyerChoicesProps) {
  const choices = [
    ...buyers.map((candidate) => ({ value: candidate.conversationId, label: candidate.username, note: notes.buyer })),
    { value: ELSEWHERE, label: "Quelqu'un d'autre", note: notes.elsewhere },
  ];

  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice, index) => (
        <label
          key={choice.value}
          className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] px-3.5 py-2.5 hover:border-[var(--ink)] has-[:checked]:border-[var(--ink)] has-[:focus-visible]:outline has-[:focus-visible]:outline-[length:var(--border-width-strong)] has-[:focus-visible]:outline-[var(--ink)]"
        >
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
            autoFocus={index === 0}
            className="h-4 w-4 shrink-0 accent-[var(--ink)]"
          />
          <span className="min-w-0 text-[length:var(--text-md)]">
            <span className="font-semibold">{choice.label}</span>
            <span className="text-[var(--muted)]"> — {choice.note}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
