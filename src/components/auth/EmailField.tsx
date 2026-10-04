import { Input } from "@/components/ui/Input";

type EmailFieldProps = {
  /* « username » sur la connexion — le gestionnaire de mots de passe y
     reconnaît l'identifiant —, « email » à l'inscription, pour proposer
     l'adresse de l'appareil. */
  autoComplete: "username" | "email";
  defaultValue?: string;
  error?: string;
};

/* L'adresse e-mail, avec les mêmes garde-fous sur les quatre formulaires du
   compte : clavier e-mail, ni majuscule ni correction automatiques — un
   téléphone transformait « julie@… » en « Julie@… » —, et la longueur
   maximale d'une adresse, que le schéma borne aussi côté serveur. */
export function EmailField({ autoComplete, defaultValue, error }: EmailFieldProps) {
  return (
    <Input
      id="email"
      label="Adresse e-mail"
      type="email"
      inputMode="email"
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      maxLength={254}
      isRequired
      defaultValue={defaultValue}
      error={error}
    />
  );
}
