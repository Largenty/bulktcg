"use client";

type QuickRepliesProps = {
  replies: string[];
  onPick: (text: string) => void;
};

/* Les trois questions qu'on pose à chaque fois — encore disponible, quand,
   quel prix — en un toucher. Elles s'ajoutent au message, elles ne
   l'envoient pas : on relit avant de partir. */
export function QuickReplies({ replies, onPick }: QuickRepliesProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Ajouter une question toute prête :</p>
      <div className="flex flex-wrap gap-2">
        {replies.map((reply) => (
          /* Une question peut dépasser la largeur d'un téléphone : la pastille
             passe alors à la ligne au lieu de pousser la page de 88 px. */
          <button key={reply} type="button" onClick={() => onPick(reply)} className="pill pill-sm max-w-full whitespace-normal text-left leading-snug">
            + {reply}
          </button>
        ))}
      </div>
    </div>
  );
}
