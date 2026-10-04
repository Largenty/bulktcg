"use client";

import { OTHER_GAME_ID, isGameId } from "@/types/game";
import { CheckboxGroup, type CheckboxSection } from "@/components/ui/CheckboxGroup";
import { EditionPicker } from "@/components/deposit/EditionPicker";
import type { EditionBlock } from "@/lib/edition-catalog";
import { listingStepNumber } from "@/lib/listing-form-steps";
import { TAG_LABELS } from "@/lib/labels";
import { getProductTagsByGame } from "@/lib/product-tags";
import type { ListingFormErrors } from "@/lib/schemas/listing-form";

type EditionTagFieldsProps = {
  /* Chaîne vide tant que le vendeur n'a pas choisi son jeu : les séries de
     Magic n'ont rien à faire sur une annonce Pokémon, et l'inverse non plus. */
  gameId: string;
  /* Les séries du jeu, demandées au serveur (useGameEditions) : null
     pendant la demande. */
  editionBlocks: EditionBlock[] | null;
  editionsFailed: boolean;
  errors: ListingFormErrors;
  defaultEditions?: string[];
  defaultTags?: string[];
};

const LOADING = "Chargement des séries de ce jeu…";
const FAILED = "Les séries de ce jeu n'ont pas pu se charger. Changez de jeu puis revenez-y, ou laissez vide : « non précisé » reste une réponse.";
const NO_GAME = `Choisissez d'abord un jeu, à l'étape ${listingStepNumber("item")} : les séries et les produits n'ont de sens que rapportés à lui.`;

export function EditionTagFields({
  gameId,
  editionBlocks,
  editionsFailed,
  errors,
  defaultEditions,
  defaultTags,
}: EditionTagFieldsProps) {
  const game = isGameId(gameId) ? gameId : null;

  const blocks = editionBlocks ?? [];
  const editionCount = blocks.reduce((sum, block) => sum + block.editions.length, 0);
  const editionsDescription = (canSearch: boolean) =>
    !game || !editionBlocks
      ? "Cochez ce que vous savez. Sur un carton non trié qui couvre quinze séries, laissez vide : « non précisé » se lit mieux qu'une liste approximative."
      : canSearch
        ? `Cherchez par code ou par nom, ou parcourez la liste, parmi les ${editionCount} séries de ce jeu, et cochez ce que vous savez. Sur un carton non trié qui en couvre quinze, laissez vide : « non précisé » se lit mieux qu'une liste approximative, et l'acheteur le comprend.`
        : `Cochez ce que vous savez, parmi les ${editionCount} séries de ce jeu — la liste défile. Sur un carton non trié qui en couvre quinze, laissez vide : « non précisé » se lit mieux qu'une liste approximative, et l'acheteur le comprend.`;

  const tagSections: CheckboxSection[] = game
    ? [
        {
          options: getProductTagsByGame(game).map((tag) => ({
            value: tag.id,
            label: TAG_LABELS[tag.id],
            hint: tag.hint,
          })),
        },
      ]
    : [];

  return (
    <>
      {/* « Autre » regroupe des jeux sans référentiel de séries ici : pas de
          liste à cocher, mais la consigne qui rend le lot trouvable. */}
      {game === OTHER_GAME_ID ? (
        <p className="notice text-[length:var(--text-md)] leading-relaxed">
          <strong className="font-semibold">Pas de liste de séries pour « Autre ».</strong> Nommez le jeu et ses
          séries dans le titre et la description : la recherche les lit.
        </p>
      ) : (
        /* La clé force un remontage au changement de jeu, et à l'arrivée de
           la liste : sans elle, une série cochée avant de changer d'avis
           resterait dans le DOM et partirait avec le formulaire, et les
           séries déjà cochées d'une annonce ne le seraient pas. */
        <EditionPicker
          key={`editions-${gameId}-${editionBlocks === null ? "loading" : "ready"}`}
          blocks={blocks}
          description={editionsDescription}
          defaultEditions={defaultEditions}
          error={errors.editions}
          emptyLabel={!game ? NO_GAME : editionsFailed ? FAILED : LOADING}
        />
      )}

      <CheckboxGroup
        key={`tags-${gameId}`}
        name="tags"
        legend="Produits inclus"
        description="Ce que le lot contient en plus des cartes en vrac : un display, un coffret, un tapis. C'est souvent ce que l'acheteur cherche en premier."
        sections={tagSections}
        defaultSelected={defaultTags}
        error={errors.tags}
        emptyLabel={NO_GAME}
      />
    </>
  );
}
