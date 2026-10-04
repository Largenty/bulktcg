/* Échantillon pour tests/theme-roles.test.mjs : trois fautes volontaires, et
   deux constructions correctes qui ne doivent pas être signalées. Ce fichier
   n'est importé par rien. */
const TONES = {
  wrong: "bg-[var(--ink)] text-[var(--chalk)]",
  right: "bg-[var(--ink)] text-[var(--on-ink)]",
};

export function Sample({ isOn }: { isOn: boolean }) {
  return (
    <div className={TONES.right}>
      <button className="rounded-[var(--radius-md)] bg-[var(--ink)] px-3 text-[var(--chalk)]">Faute</button>
      <span className={["grid bg-[var(--card)] text-[var(--chalk)]", "peer-checked:bg-[var(--ink)]"].join(" ")}>✓</span>
      <span className={isOn ? "bg-[var(--ink)] text-[var(--on-ink)]" : "text-[var(--chalk)]"}>Correct</span>
    </div>
  );
}
