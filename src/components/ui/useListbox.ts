"use client";

import { useEffect, useRef, useState } from "react";

/* L'état et le clavier de la liste déroulante maison (Select) : ouverte ou
   non, quelle option est active, et le motif combobox de l'APG — flèches,
   Home, End, Entrée, Espace, Échap, Tab. Le composant ne garde que le rendu.
   Un clic hors de la liste la referme. */
export function useListbox<T>({ options, selectedIndex, onCommit }: {
  options: T[];
  selectedIndex: number;
  onCommit: (option: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]);

  function open() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (option === undefined) return;
    onCommit(option);
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      if (isOpen) event.stopPropagation();
      setIsOpen(false);
      return;
    }
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      open();
      return;
    }
    if (!isOpen) return;

    const moves: Record<string, (index: number) => number> = {
      ArrowDown: (index) => Math.min(index + 1, options.length - 1),
      ArrowUp: (index) => Math.max(index - 1, 0),
      Home: () => 0,
      End: () => options.length - 1,
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setActiveIndex(move);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(activeIndex);
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  return {
    isOpen,
    activeIndex,
    setActiveIndex,
    rootRef,
    optionRefs,
    toggle: () => (isOpen ? setIsOpen(false) : open()),
    commit,
    handleKeyDown,
  };
}
