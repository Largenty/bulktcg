import type { ProfileRow } from "@/lib/data/rows";
import { getCityByPair, type City } from "@/lib/cities";
import { buildInitials, daysAgo, daysFromNow } from "@/lib/mock/seed";

/* Les mocks produisent des lignes au format de la base, pas des objets du
   domaine : la conversion snake_case -> camelCase de lib/data/mappers est
   ainsi exercée à chaque rendu et à chaque test, et non pas seulement le
   jour de la bascule.

   Le nombre d'annonces actives n'est pas stocké : il est compté sur les
   annonces réelles. Un compteur écrit à la main finit toujours par
   contredire la liste affichée juste en dessous. sold_listing_count, lui,
   est bien une donnée de profil — l'historique complet du vendeur, dont les
   33 annonces de démonstration ne montrent qu'une fraction. */
type ProfileInput = Omit<
  ProfileRow,
  | "avatar_initials"
  | "bio"
  | "account_type"
  | "company_name"
  | "pro_until"
  | "siret"
  | "shop_address"
  | "shop_hours"
  | "shop_website"
  | "legal_name"
  | "pro_verified_at"
  | "cardmarket_url"
  | "cardnexus_url"
> & {
  bio?: string | null;
  /* Un compte pro a un nom de boutique, une fin de forfait et une fiche
     boutique ; les autres prennent les valeurs par défaut de la base. Le
     SIRET, la raison sociale et les profils de places de marché restent
     vides : un numéro inventé mais vraisemblable, ou le lien vers le compte
     Cardmarket de quelqu'un d'autre, serait pire qu'un « — ». Les sites
     sont en .example, un domaine réservé. */
  pro?: { companyName: string; until: string; address?: string; hours?: string; website?: string };
};

function withInitials({ pro, ...seller }: ProfileInput): ProfileRow {
  return {
    ...seller,
    bio: seller.bio ?? null,
    avatar_initials: buildInitials(seller.username),
    account_type: pro ? "pro" : "individual",
    company_name: pro?.companyName ?? null,
    pro_until: pro?.until ?? null,
    siret: null,
    shop_address: pro?.address ?? null,
    shop_hours: pro?.hours ?? null,
    shop_website: pro?.website ?? null,
    legal_name: null,
    pro_verified_at: null,
    cardmarket_url: null,
    cardnexus_url: null,
  };
}

/* La note globale se déduit des trois critères, comme dans
   public.refresh_rating : écrite à la main à côté, elle finirait par les
   contredire. */
function ratings(
  count: number,
  averages: { punctuality: number; responsiveness: number; reliability: number },
): Pick<ProfileRow, "rating_count" | "rating_avg" | "punctuality_avg" | "responsiveness_avg" | "reliability_avg"> {
  const overall = (averages.punctuality + averages.responsiveness + averages.reliability) / 3;
  return {
    rating_count: count,
    rating_avg: Math.round(overall * 10) / 10,
    punctuality_avg: averages.punctuality,
    responsiveness_avg: averages.responsiveness,
    reliability_avg: averages.reliability,
  };
}

/* Un compte sans avis n'a pas une note de 0 : il n'en a pas. */
const NO_RATING = {
  rating_count: 0,
  rating_avg: null,
  punctuality_avg: null,
  responsiveness_avg: null,
  reliability_avg: null,
};

/* Quinze comptes volontairement dissemblables : un vétéran à 162 ventes,
   un compte créé la semaine dernière sans le moindre avis, un vendeur mal noté.
   C'est ce qui fait apparaître les vrais problèmes d'affichage de la note. */
export const MOCK_PROFILE_ROWS: ProfileRow[] = [
  {
    id: "u-01",
    username: "lecomptoirdukado",
    city: "Avignon",
    postal_code: "84000",
    bio: "Vrac Pokémon et Magic depuis 2015. Rendez-vous à la gare TGV d'Avignon, en semaine après 18 h.",
    ...ratings(156, { punctuality: 5, responsiveness: 4.8, reliability: 4.9 }),
    sold_listing_count: 162,
    created_at: daysAgo(1180),
  },
  {
    id: "u-02",
    username: "julie_cartes",
    city: "Carpentras",
    postal_code: "84200",
    bio: "Je revends les classeurs de mes enfants, triés par série. Remise au parking du marché de Carpentras.",
    ...ratings(41, { punctuality: 4.8, responsiveness: 4.5, reliability: 4.8 }),
    sold_listing_count: 47,
    created_at: daysAgo(620),
  },
  {
    id: "u-03",
    username: "tcg_du_ventoux",
    city: "Monteux",
    postal_code: "84170",
    ...ratings(2, { punctuality: 5, responsiveness: 4.5, reliability: 4 }),
    sold_listing_count: 2,
    created_at: daysAgo(24),
  },
  {
    id: "u-04",
    username: "bastien26",
    city: "Valence",
    postal_code: "26000",
    ...ratings(88, { punctuality: 4.4, responsiveness: 4.7, reliability: 4.7 }),
    sold_listing_count: 95,
    created_at: daysAgo(910),
  },
  {
    id: "u-05",
    username: "sophie_orange",
    city: "Orange",
    postal_code: "84100",
    ...ratings(23, { punctuality: 4.9, responsiveness: 4.8, reliability: 5 }),
    sold_listing_count: 25,
    created_at: daysAgo(430),
  },
  {
    id: "u-06",
    username: "pioupiou_du_84",
    city: "Cavaillon",
    postal_code: "84300",
    ...ratings(9, { punctuality: 3.8, responsiveness: 4.4, reliability: 4.4 }),
    sold_listing_count: 11,
    created_at: daysAgo(215),
  },
  {
    id: "u-07",
    username: "dracaufeu_addict",
    city: "Montélimar",
    postal_code: "26200",
    ...ratings(64, { punctuality: 4.6, responsiveness: 4.9, reliability: 4.9 }),
    sold_listing_count: 70,
    created_at: daysAgo(760),
  },
  {
    /* Compte tout neuf : ratingAvg est null, pas 0. Un vendeur sans avis
       n'a pas une mauvaise note, il n'a pas de note. */
    id: "u-08",
    username: "lemasqueetlaplume",
    city: "L'Isle-sur-la-Sorgue",
    postal_code: "84800",
    ...NO_RATING,
    sold_listing_count: 0,
    created_at: daysAgo(6),
  },
  {
    id: "u-09",
    username: "romain_mtg",
    city: "Romans-sur-Isère",
    postal_code: "26100",
    ...ratings(31, { punctuality: 4.5, responsiveness: 4.1, reliability: 4.6 }),
    sold_listing_count: 36,
    created_at: daysAgo(540),
  },
  {
    id: "u-10",
    username: "karine_apt",
    city: "Apt",
    postal_code: "84400",
    ...ratings(12, { punctuality: 5, responsiveness: 5, reliability: 5 }),
    sold_listing_count: 12,
    created_at: daysAgo(290),
  },
  {
    id: "u-11",
    username: "nordikcards",
    city: "Bollène",
    postal_code: "84500",
    ...ratings(17, { punctuality: 4.3, responsiveness: 3.2, reliability: 4.2 }),
    sold_listing_count: 22,
    created_at: daysAgo(680),
  },
  {
    id: "u-12",
    username: "theo_yugi",
    city: "Pertuis",
    postal_code: "84120",
    ...ratings(6, { punctuality: 4.8, responsiveness: 4.5, reliability: 4.8 }),
    sold_listing_count: 7,
    created_at: daysAgo(120),
  },
  /* Trois boutiques. Deux au forfait actif — dont une qui expire dans deux
     jours — et une dont le forfait a expiré : elle ne voit plus les lots
     réservés, mais reste une boutique — badge, enseigne et fiche compris.
     Sans elle, le chemin « forfait expiré » ne serait jamais exercé. */
  {
    id: "u-13",
    username: "repaire_du_joueur",
    city: "Avignon",
    postal_code: "84000",
    bio: "Boutique de jeux rue Carnot depuis 2011. Nous rachetons le vrac au kilo et les collections entières, paiement comptant.",
    ...ratings(41, { punctuality: 4.7, responsiveness: 4.8, reliability: 4.9 }),
    sold_listing_count: 58,
    created_at: daysAgo(840),
    pro: {
      companyName: "Le Repaire du Joueur",
      until: daysFromNow(21),
      address: "Rue Carnot, 84000 Avignon",
      hours: "Du mardi au samedi, de 10 h à 19 h",
      website: "https://repaire-du-joueur.example",
    },
  },
  {
    id: "u-14",
    username: "cartes_et_des",
    city: "Valence",
    postal_code: "26000",
    bio: "Cartes & Dés, Valence centre. Tournois le vendredi, rachat de collections sur rendez-vous.",
    ...ratings(19, { punctuality: 4.5, responsiveness: 4.4, reliability: 4.9 }),
    sold_listing_count: 23,
    created_at: daysAgo(510),
    pro: {
      companyName: "Cartes & Dés",
      until: daysFromNow(2),
      address: "Centre-ville, 26000 Valence",
      hours: "Du mercredi au samedi, rachats sur rendez-vous",
    },
  },
  {
    id: "u-15",
    username: "le_de_d_orange",
    city: "Orange",
    postal_code: "84100",
    ...ratings(8, { punctuality: 4.4, responsiveness: 3.9, reliability: 4.6 }),
    sold_listing_count: 9,
    created_at: daysAgo(400),
    pro: { companyName: "Le Dé d'Orange", until: daysAgo(9) },
  },
].map(withInitials);

const PROFILE_ROWS_BY_ID = new Map(MOCK_PROFILE_ROWS.map((profile) => [profile.id, profile]));

/* Le profil d'un compte de démonstration. Un identifiant inconnu est une
   incohérence des données : il lève au chargement, pas au rendu. */
export function mockProfileRow(userId: string): ProfileRow {
  const profile = PROFILE_ROWS_BY_ID.get(userId);
  if (!profile) throw new Error(`Mock incohérent : profil ${userId} introuvable.`);
  return profile;
}

/* La commune d'un compte, au référentiel : ses lots et ses recherches s'y
   situent. */
export function mockHomeCity(profile: ProfileRow): City {
  const city = getCityByPair(profile.city, profile.postal_code);
  if (!city) throw new Error(`Mock incohérent : ville ${profile.city} absente du référentiel.`);
  return city;
}
