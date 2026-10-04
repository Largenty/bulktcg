"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { readAppliedChoice, saveThemeChoice, subscribeToAppliedChoice, type ThemeChoice } from "@/lib/theme";

const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: "monitor" | "sun" | "moon" }> = [
  { value: "system", label: "Système", icon: "monitor" },
  { value: "light", label: "Clair", icon: "sun" },
  { value: "dark", label: "Sombre", icon: "moon" },
];

/* Deux tons : sur l'ardoise du pied de page, et sur le papier du menu mobile
   et des paramètres. L'option choisie est un aplat : --on-chalk sur la
   craie, --on-ink sur l'encre — la craie sur l'encre tomberait à 1:1 en
   sombre, où l'encre devient claire. */
const TONES = {
  inverse: {
    frame: "border-[var(--slate-line)]",
    option: "text-[var(--chalk-soft)] hover:text-[var(--chalk)] aria-pressed:bg-[var(--chalk)] aria-pressed:text-[var(--on-chalk)]",
  },
  default: {
    frame: "border-[var(--line-strong)]",
    option: "text-[var(--ink-soft)] hover:text-[var(--ink)] aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--on-ink)]",
  },
};

/* Le réglage complet : suivre l'appareil, ou imposer un thème. L'interrupteur
   de l'en-tête ne fait que basculer entre clair et sombre. Le serveur ne
   connaît pas le choix : il rend « Système », et React corrige après
   l'hydratation, sans désaccord — les couleurs, elles, sont justes dès la
   première peinture. */
export function ThemeChoiceControl({ tone = "inverse" }: { tone?: keyof typeof TONES }) {
  const choice = useSyncExternalStore(subscribeToAppliedChoice, readAppliedChoice, () => "system" as ThemeChoice);
  const selected = OPTIONS.find((option) => option.value === choice);

  return (
    <div role="group" aria-label="Thème d'affichage" className={`inline-flex gap-1 rounded-[var(--radius-md)] border-[length:var(--border-width)] p-1 ${TONES[tone].frame}`}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={choice === option.value}
          onClick={() => saveThemeChoice(option.value)}
          className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-[length:var(--text-sm)] font-medium transition-colors ${TONES[tone].option}`}
        >
          <Icon name={option.icon} size={15} />
          {option.label}
        </button>
      ))}
      {/* aria-pressed qui change n'est pas toujours annoncé : l'état courant
          est dit en toutes lettres, sans rien afficher. */}
      <output className="sr-only" aria-live="polite">
        Thème : {selected?.label ?? ""}
      </output>
    </div>
  );
}
