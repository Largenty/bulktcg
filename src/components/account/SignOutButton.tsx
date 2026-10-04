import { signOutAction } from "@/app/actions/auth";
import { buttonClassName } from "@/components/ui/Button";

/* Se déconnecter : un formulaire, qui part en POST même sans JavaScript.
   Rendu seulement quand une vraie session existe (canSignOut) : la session
   de démonstration ne se ferme pas, et aucun bouton ne prétend le faire. */
export function SignOutButton() {
  return (
    <form action={signOutAction} className="shrink-0 self-start sm:self-center">
      <button type="submit" className={buttonClassName("outline-inverse", "sm")}>
        Se déconnecter
      </button>
    </form>
  );
}
