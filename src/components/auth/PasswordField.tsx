"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type PasswordFieldProps = {
  /* Un nouveau mot de passe — inscription, réinitialisation — ou celui
     qu'on tape pour se connecter : le navigateur propose d'en générer un
     dans le premier cas, de remplir l'enregistré dans le second. */
  isNew: boolean;
  label?: string;
  error?: string;
  /* Un lien sous le champ, comme « Mot de passe oublié ? ». */
  after?: ReactNode;
};

/* Le mot de passe, affichable d'un bouton plutôt que tapé deux fois : on
   vérifie ce qu'on a écrit sans champ de confirmation. Jamais de
   autocomplete="off", qui empêcherait les gestionnaires de mots de passe —
   ce sont eux qui rendent possibles les mots de passe longs. Le coller
   reste permis, pour la même raison. */
export function PasswordField({ isNew, label = "Mot de passe", error, after }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Input
        id="password"
        label={label}
        type={isVisible ? "text" : "password"}
        autoComplete={isNew ? "new-password" : "current-password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        minLength={isNew ? 12 : undefined}
        maxLength={128}
        isRequired
        error={error}
        hint={isNew ? "12 caractères au moins. Une phrase de quelques mots se retient mieux qu'un mot compliqué." : undefined}
        trailing={
          /* Le nom change avec l'état, et contient le texte visible
             (WCAG 2.5.3) : pas d'aria-pressed, qui exigerait un nom fixe. */
          <Button
            variant="quiet"
            size="sm"
            aria-controls="password"
            aria-label={isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            onClick={() => setIsVisible((current) => !current)}
          >
            {isVisible ? "Masquer" : "Afficher"}
          </Button>
        }
      />
      {after}
    </div>
  );
}
