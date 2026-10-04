"use client";

import { useId, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@/components/ui/Icon";

type SheetProps = {
  title: string;
  /* Contenu du bouton qui ouvre la feuille. */
  trigger: ReactNode;
  triggerClassName?: string;
  /* Nom accessible du déclencheur quand son contenu n'est qu'une icône. */
  triggerLabel?: string;
  children: ReactNode;
  /* Pied fixe, qui reçoit de quoi refermer la feuille : « Voir les 12
     annonces » ferme et montre la grille. */
  footer?: (close: () => void) => ReactNode;
  /* Une navigation ferme la feuille : sans ça, le menu resterait ouvert
     par-dessus la page qu'on vient de demander. */
  isClosedOnNavigate?: boolean;
  className?: string;
};

/* Feuille modale sur <dialog> natif : le piège de focus, Échap, l'inertie du
   reste de la page et le retour du focus au déclencheur viennent du
   navigateur, pas d'un script qui les imiterait.

   Son contenu n'existe que feuille ouverte. Fermée, elle laissait dans la
   page un titre et une copie de ce qu'elle porte : « Menu » était le premier
   titre de chaque page, avant son h1, et le <nav> du menu doublait celui de
   l'en-tête. Le contenu est rendu avant showModal(), qui y place le focus. */
export function Sheet({
  title,
  trigger,
  triggerClassName,
  triggerLabel,
  children,
  footer,
  isClosedOnNavigate = true,
  className,
}: SheetProps) {
  const dialogId = useId();
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);

  /* Le <dialog> se retrouve par son identifiant plutôt que par une ref :
     `close` part dans le pied, que l'appelant rend, et le compilateur de
     React refuse qu'une fonction appelée pendant un rendu lise une ref. */
  function findDialog(): HTMLDialogElement | null {
    const element = document.getElementById(dialogId);
    return element instanceof HTMLDialogElement ? element : null;
  }

  function open() {
    flushSync(() => setIsOpen(true));
    findDialog()?.showModal();
  }

  function close() {
    findDialog()?.close();
  }

  function handleClick(event: React.MouseEvent<HTMLDialogElement>) {
    /* Un clic sur le voile tombe sur le <dialog> lui-même, hors de son
       contenu. */
    if (event.target === event.currentTarget) {
      close();
      return;
    }
    if (isClosedOnNavigate && (event.target as Element).closest("a[href]")) close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {/* Échap, un clic sur le voile ou close() : l'événement close vide la
          feuille, une fois le focus rendu au déclencheur. */}
      <dialog
        id={dialogId}
        aria-labelledby={isOpen ? titleId : undefined}
        onClick={handleClick}
        onClose={() => setIsOpen(false)}
        className={["sheet", className].filter(Boolean).join(" ")}
      >
        {isOpen ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 border-b-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] px-5 py-3">
              <h2 id={titleId} className="display display-h3">
                {title}
              </h2>
              <button
                type="button"
                onClick={close}
                className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] hover:bg-[var(--tint)]"
              >
                <Icon name="close" size={20} />
                <span className="sr-only">Fermer</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer ? (
              <div className="border-t-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                {footer(close)}
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
