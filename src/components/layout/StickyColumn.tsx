"use client";

import { useEffect, useRef, type ReactNode } from "react";

type StickyColumnProps = {
  className?: string;
  children: ReactNode;
};

/* Écart laissé sous la colonne quand elle colle par le bas. */
const BOTTOM_GAP = 16;

/* La colonne qui suit la lecture : panneau de filtres, colonne d'action d'une
   fiche, aperçu d'un dépôt. Tant qu'elle tient dans l'écran, elle se cale
   sous l'en-tête. Plus haute que lui, elle défilait sur elle-même, avec sa
   propre barre de défilement — une annonce réservée, sur un écran de 860 px,
   en montrait une en permanence, et le panneau « Affiner » dès 1 000 px.

   Elle suit maintenant la page dans les deux sens : en descendant, elle
   défile jusqu'à montrer son bas, puis colle par le bas ; en remontant, elle
   redescend aussitôt jusqu'à montrer son haut, puis colle sous l'en-tête. Une
   seule barre de défilement, celle de la page, et le premier filtre revient
   sans remonter toute la liste.

   Le mécanisme tient dans la valeur de `top` d'un élément sticky, ajustée à
   chaque défilement entre deux bornes : l'accroche haute (styles/base/placement.css) et
   l'accroche basse, hauteur de la fenêtre moins celle de la colonne. Sans
   JavaScript, la colonne colle par le haut. Au clavier, un élément qui
   reçoit le focus hors de l'écran y est ramené. */
export function StickyColumn({ className, children }: StickyColumnProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const column = ref.current;
    if (!column) return;
    let offset: number | null = null;
    let range: [number, number] | null = null;
    let lastScrollY = window.scrollY;
    let frame = 0;

    /* Les deux bornes de `top`, relues quand la colonne ou la fenêtre
       changent de taille. L'accroche haute vient du CSS, lue sans le style
       posé ici ; sous 1 024 px la colonne n'est pas épinglée. */
    function measure() {
      if (!column) return;
      column.style.top = "";
      const style = getComputedStyle(column);
      if (style.position !== "sticky") {
        range = null;
        return;
      }
      const high = parseFloat(style.top);
      range = [Math.min(high, window.innerHeight - column.offsetHeight - BOTTOM_GAP), high];
    }

    function place(shift: number) {
      if (!column || !range) return;
      const [low, high] = range;
      offset = Math.min(high, Math.max(low, (offset ?? high) + shift));
      column.style.top = `${offset}px`;
    }

    function remeasure() {
      measure();
      place(0);
    }

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const scrollY = window.scrollY;
        place(lastScrollY - scrollY);
        lastScrollY = scrollY;
      });
    }

    function followFocus(event: FocusEvent) {
      if (!(event.target instanceof HTMLElement)) return;
      const box = event.target.getBoundingClientRect();
      const headerBottom = document.querySelector("body > header")?.getBoundingClientRect().bottom ?? 0;
      if (box.top < headerBottom) place(headerBottom - box.top + BOTTOM_GAP);
      else if (box.bottom > window.innerHeight) place(window.innerHeight - box.bottom - BOTTOM_GAP);
    }

    /* Au montage, la page peut être déjà défilée — un retour arrière qui
       restaure la position, une hydratation arrivée après le premier
       défilement : la colonne se place comme si l'on était descendu depuis
       le haut, au lieu de rester accrochée en haut, son bas hors d'écran. */
    measure();
    place(-window.scrollY);

    const observer = new ResizeObserver(remeasure);
    observer.observe(column);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    column.addEventListener("focusin", followFocus);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      column.removeEventListener("focusin", followFocus);
      column.style.top = "";
    };
  }, []);

  return (
    <div ref={ref} className={["sticky-column", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
