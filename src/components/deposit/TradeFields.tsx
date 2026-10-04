"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";

type TradeFieldsProps = {
  /* « on » quand l'annonce modifiée était déjà ouverte à l'échange. */
  defaultOpen?: string;
  defaultNote?: string;
  error?: string;
};

/* Ouvert à l'échange : le prix reste — il donne la valeur de référence —,
   et le vendeur accepte aussi des cartes contre le lot. Le champ « contre
   quoi » n'apparaît qu'une fois la case cochée ; décochée, sa valeur n'est
   pas envoyée. */
export function TradeFields({ defaultOpen = "", defaultNote = "", error }: TradeFieldsProps) {
  const [isOpen, setOpen] = useState(defaultOpen !== "");

  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        id="openToTrade"
        defaultChecked={isOpen}
        onChange={(event) => setOpen(event.currentTarget.checked)}
        label="Ouvert à l'échange"
        description="Vous acceptez aussi des cartes contre le lot. Le prix reste affiché : il donne la valeur de référence."
      />
      {isOpen ? (
        <Input
          id="tradeNote"
          defaultValue={defaultNote}
          label="Contre quoi ?"
          maxLength={140}
          error={error}
          placeholder="Du vrac One Piece, un display scellé récent…"
          hint="Facultatif. Ce que vous accepteriez : jeu, séries, formats."
        />
      ) : null}
    </div>
  );
}
