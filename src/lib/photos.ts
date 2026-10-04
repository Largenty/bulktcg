import type { GameId } from "@/types/game";
import { createRandom } from "@/lib/random";

/* Photos de démonstration.

   Ce sont de vraies photographies hébergées par Unsplash. Ce commentaire
   affirmait qu'elles avaient été choisies une par une après examen ; la
   revue de septembre 2026, planche contact à l'appui, a trouvé l'inverse :
   des cartes de baseball, des timbres et deux jeux de plateau sur les
   annonces Magic, du Yu-Gi-Oh, du Dragon Ball et une carte Pokémon sur les
   annonces One Piece et Naruto. Les descriptions automatiques d'Unsplash
   (« red ceramic mug » pour une pile de cartes Pokémon) ne valent rien : une
   photo n'entre ici qu'après avoir été regardée.

   Règle : une photo qui montre un autre jeu que celui de l'annonce est pire
   que pas de photo. Un jeu sans photographie honnête a un pool vide, et ses
   annonces montrent l'emplacement aux couleurs du jeu.

   Le crédit photographe est obligatoire côté Unsplash, il est donc porté par
   la donnée et affiché sur la page d'annonce.

   En phase 2 ce fichier disparaît : storage_path portera la clé d'un
   fichier chez Cloudflare Images, et resolvePhotoUrl en composera
   l'adresse. La forme de ListingPhoto ne change pas. */

export type StockPhoto = {
  id: string;
  /* URL de base, sans paramètre : les dimensions sont ajoutées au rendu. */
  url: string;
  alt: string;
  photographer: string;
  username: string;
};

export const STOCK_PHOTOS: Record<GameId, StockPhoto[]> = {
  pokemon: [
    {
      id: "TWCnHKKhqSo",
      url: "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3",
      alt: "A collection of colorful Pokemon trading cards scattered across a flat surface",
      photographer: "Thimo Pedersen",
      username: "thimo",
    },
    {
      id: "dip9IIwUK6w",
      url: "https://images.unsplash.com/photo-1613771404721-1f92d799e49f",
      alt: "A red and white plastic ball resting on a pile of trading cards",
      photographer: "Thimo Pedersen",
      username: "thimo",
    },
    {
      id: "fDAv7lWawtk",
      url: "https://images.unsplash.com/photo-1621568670868-24a7dfc590e9",
      alt: "Japanese Pokémon cards spread on a wooden table, a Charizard in a top loader",
      photographer: "Erik Mclean",
      username: "introspectivedsgn",
    },
    {
      id: "W7KDN4OB_zI",
      url: "https://images.unsplash.com/photo-1647892591880-58c55fd726d8",
      alt: "a pile of pokemon trading cards sitting on top of each other",
      photographer: "Giorgio Trovato",
      username: "giorgiotrovato",
    },
    {
      id: "KtTF68ZjBak",
      url: "https://images.unsplash.com/photo-1628968434441-d9c1c66dcde7",
      alt: "A carpet of common Pokémon cards seen from above",
      photographer: "Mick Haupt",
      username: "rocinante_11",
    },
    {
      id: "H5PJ3z4WqCc",
      url: "https://images.unsplash.com/photo-1647892591717-28c7fd63bb3f",
      alt: "a pile of pokemon trading cards sitting on top of each other",
      photographer: "Giorgio Trovato",
      username: "giorgiotrovato",
    },
    {
      id: "mGUs05ZMeec",
      url: "https://images.unsplash.com/photo-1703023689733-6a4281149189",
      alt: "a bunch of pokemon cards on a table",
      photographer: "Thimo Pedersen",
      username: "thimo",
    },
    {
      id: "fHWenpz2LhQ",
      url: "https://images.unsplash.com/photo-1647893977168-6316f6c9ae44",
      alt: "a stack of cards with a pokemon logo on them",
      photographer: "Giorgio Trovato",
      username: "giorgiotrovato",
    },
    {
      id: "t_x5URJUK4c",
      url: "https://images.unsplash.com/photo-1647892591703-4552c35a58e7",
      alt: "a pile of pokemon trading cards sitting on top of each other",
      photographer: "Giorgio Trovato",
      username: "giorgiotrovato",
    },
    {
      id: "CnKur6pKECs",
      url: "https://images.unsplash.com/photo-1640271215810-ce65ba65ef0b",
      alt: "a group of pokemon cards sitting on top of a table",
      photographer: "Halfcut Pokemon",
      username: "halfcutpokemon",
    },
    {
      id: "i1YFIUHWozI",
      url: "https://images.unsplash.com/photo-1647893976852-71b2f6ba10e4",
      alt: "a stack of pokemon cards sitting on top of each other",
      photographer: "Giorgio Trovato",
      username: "giorgiotrovato",
    },
  ],
  yugioh: [
    {
      id: "8tNQnMXDK7A",
      url: "https://images.unsplash.com/photo-1620336655174-32ccc95d0e2d",
      alt: "person holding red and white playing card",
      photographer: "Erik Mclean",
      username: "introspectivedsgn",
    },
    {
      id: "kiwkiNq07PA",
      url: "https://images.unsplash.com/photo-1708856034090-627677aea472",
      alt: "a man holding a deck of cards in his hands",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
    {
      id: "KHEqvgcECv0",
      url: "https://images.unsplash.com/photo-1674106890436-368ce68342f1",
      alt: "a group of cards sitting on top of a table",
      photographer: "Keenan Duriaux",
      username: "betrotheddemon",
    },
    {
      id: "V_yLZrPj-t4",
      url: "https://images.unsplash.com/photo-1668720028726-c4997f31f216",
      alt: "a couple of cards on a table",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
    {
      id: "ZKMCjtfQQeo",
      url: "https://images.unsplash.com/photo-1782762042643-5b8142e68fc3",
      alt: "A hand holding several vibrant trading cards",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
    {
      id: "PPRTdaswJhM",
      url: "https://images.unsplash.com/photo-1708856034718-2c4107643f16",
      alt: "a person holding a card in their hand",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
    {
      id: "U5uujWVegek",
      url: "https://images.unsplash.com/photo-1690326442991-f07ff48b739a",
      alt: "three cards of the same type on a black surface",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
    {
      id: "wFqQhQZeMf4",
      url: "https://images.unsplash.com/photo-1746572625980-b04f5e186a8d",
      alt: "Hand holding yu-gi-oh! cards among blooming flowers",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
    {
      id: "DtenaxpCOYQ",
      url: "https://images.unsplash.com/photo-1746572625977-f59f80ab50d9",
      alt: "Hand holding yu-gi-oh! cards with a floral background",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
    {
      id: "cnbXMNp-2C8",
      url: "https://images.unsplash.com/photo-1746572651436-7da5d437ebca",
      alt: "A yu-gi-oh! card is shown on a deck",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
    {
      id: "-QtEaAl0eD4",
      url: "https://images.unsplash.com/photo-1742743031898-74c61475c642",
      alt: "Someone is holding yu-gi-oh! cards",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
    {
      id: "Txc9q9w1Cus",
      url: "https://images.unsplash.com/photo-1742743032109-d4af9c93932a",
      alt: "A yu-gi-oh! card is resting on wood",
      photographer: "Jovan Vasiljević",
      username: "jovanvasiljevic",
    },
  ],
  magic: [
    {
      id: "Vp8RnXSnJ6I",
      url: "https://images.unsplash.com/photo-1593814681464-eef5af2b0628",
      alt: "Five Magic: The Gathering basic lands fanned out on black",
      photographer: "Ryan Quintal",
      username: "ryanquintal",
    },
    {
      id: "tC9B-BvW4eU",
      url: "https://images.unsplash.com/photo-1732944710507-feecdfb4f2c1",
      alt: "A person holding a bunch of cards in their hands",
      photographer: "Kayl Photo",
      username: "kayl_photo",
    },
    {
      id: "zt2m0PBA-FE",
      url: "https://images.unsplash.com/photo-1593814681110-cbf22baf6d79",
      alt: "magic the gathering trading cards",
      photographer: "Ryan Quintal",
      username: "ryanquintal",
    },
    {
      id: "_IFhU3bl1p8",
      url: "https://images.unsplash.com/photo-1789707627113-b0d23c31ba07",
      alt: "Magic: The Gathering lands and creatures spread on a white lattice table",
      photographer: "Joshua Fernandez",
      username: "joshuafernandez",
    },
    {
      id: "OvN4OkhkTLo",
      url: "https://images.unsplash.com/photo-1513002433973-e0a181372d60",
      alt: "A player holding up the back of a Magic: The Gathering card",
      photographer: "Wayne Low",
      username: "wayneshin",
    },
  ],
  /* Aucune photographie honnête de ces trois jeux sur Unsplash : zéro
     résultat pour Riftbound, et l'ancien pool « cartes d'anime » partagé
     par One Piece et Naruto montrait en réalité trois photos de Yu-Gi-Oh
     (dos KONAMI bien visible), une carte Dragon Ball et une carte Pokémon.
     Leurs annonces de démonstration s'affichent donc sans photo, avec
     l'emplacement aux couleurs du jeu — c'est exactement ce qu'il est fait
     pour rendre. */
  onepiece: [],
  /* Aucune photo de Lorcana n'a encore été regardée et vérifiée : ses
     annonces s'affichent sans photo, comme One Piece, Riftbound et Naruto. */
  lorcana: [],
  riftbound: [],
  naruto: [],
  /* « Autre » couvre des jeux différents d'une annonce à l'autre : aucune
     photo ne peut les représenter tous, et une photo de Digimon sur un lot
     Digimon serait pire que pas de photo. */
  other: [],
};

const PHOTOS_BY_URL = new Map(
  Object.values(STOCK_PHOTOS)
    .flat()
    .map((photo) => [photo.url, photo]),
);

export function getStockPhotoByUrl(url: string): StockPhoto | null {
  /* L'URL de base : les dimensions ajoutées au rendu ne comptent pas. */
  const [base = ""] = url.split("?");
  return PHOTOS_BY_URL.get(base) ?? null;
}

/* Choix déterministe : la même annonce montre toujours les mêmes photos,
   dans le même ordre, au serveur comme au client.

   Le rang est le numéro de l'annonce dans son jeu. Il décale le point de
   départ dans le pool, ce qui garantit que deux annonces voisines du même
   jeu n'ouvrent pas sur la même image — c'est la première photo qu'on voit
   dans la grille, et deux vignettes identiques donnent l'impression d'un
   bug d'affichage. Le tirage aléatoire ne concerne que les photos suivantes. */
export function pickStockPhotos(
  gameId: GameId,
  seed: number,
  count: number,
  rank: number,
): StockPhoto[] {
  const pool = STOCK_PHOTOS[gameId];
  /* Un jeu sans photo honnête a un pool vide : aucun rang n'y désigne de
     photo (rank % 0 vaut NaN), et ses annonces n'en ont aucune. */
  const first = pool[rank % pool.length];
  if (first === undefined) return [];

  const random = createRandom(seed);
  const remaining = pool.filter((photo) => photo.id !== first.id);
  const picked: StockPhoto[] = [first];

  while (picked.length < count && remaining.length > 0) {
    picked.push(...remaining.splice(Math.floor(random() * remaining.length), 1));
  }
  /* Le pool est plus petit que le nombre de photos annoncé : on boucle
     plutôt que de rendre trois photos quand la vignette en promet huit. */
  while (picked.length < count) {
    const position = picked.length % pool.length;
    picked.push(...pool.slice(position, position + 1));
  }
  return picked;
}
