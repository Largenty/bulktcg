import type { Game, GameId } from "@/types/game";
import type { Listing } from "@/types/listing";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { GameDividers } from "@/components/market/GameDividers";
import { SearchBar, listingSearchFields } from "@/components/search/SearchBar";
import { Icon } from "@/components/ui/Icon";
import { IntentLink } from "@/components/ui/IntentLink";
import { routes } from "@/lib/routes";

type HomeHeroProps = {
  games: Game[];
  cities: string[];
  recentListings: Listing[];
  countByGame: Record<GameId, number>;
  totalCount: number;
};

/* L'accueil dit ce qu'est le site en une phrase, en très grand et sur
   toute la largeur, donne la recherche, et montre tout de suite ce qu'on
   peut acheter : les derniers dépôts, dans leur vrai ordre, sous les
   intercalaires des jeux — la boîte de rangement ouverte sur l'onglet
   « Tous les jeux ».

   Le classeur qui occupait cette place montrait six pochettes dans le tri
   par défaut, qui remonte les annonces payées : quatre d'entre elles étaient
   exactement les lots « À la une » de la section suivante. */
export function HomeHero({ games, cities, recentListings, countByGame, totalCount }: HomeHeroProps) {
  return (
    <div className="container">
      {/* L'écran entier, navigation comprise : la manchette et la recherche au
          centre, les intercalaires des jeux posés au bas de l'écran — ils
          ouvrent sur les derniers dépôts, juste dessous. */}
      <div className="hero-screen flex flex-col">
        <div className="flex flex-1 flex-col justify-center gap-10 py-12 lg:gap-14 lg:py-16">
          {/* Le conteneur de requête : la manchette se mesure sur sa largeur à
              lui, pas sur celle de la fenêtre. */}
          <div className="@container">
            <p className="eyebrow text-[var(--muted)]">Partout en France · de la main à la main</p>
            {/* « Le carton entier » jouait sur l'ancien nom, Carton Plein. Le
                bulk est le mot des joueurs pour ce que le site vend — et celui
                qui lui donne son nom. */}
            <h1 className="display display-hero mt-4 lg:mt-6">Tout le bulk, près de chez vous.</h1>
          </div>

          {/* Sous la manchette, la recherche sur toute la largeur, et sous elle
              ce que le site est. La phrase était d'abord perchée à droite du
              titre, puis à côté de la recherche, qui ne prenait alors que les
              deux tiers de la ligne. */}
          <div className="flex flex-col gap-5">
            <SearchBar action={routes.listings} submitLabel="Chercher" size="lg" fields={listingSearchFields(cities)} />
            <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)] lg:text-[length:var(--text-lead)]">
              Vrac, classeurs, decks et scellé, entre particuliers et en main propre. Ni envoi, ni commission.
            </p>
          </div>
        </div>

        {/* L'onglet ouvert : la grille dessous montre tous les jeux. Ce n'est
            pas la page courante, d'où un marquage et non aria-current. */}
        <GameDividers
          label="Parcourir par jeu"
          games={games}
          countByGame={countByGame}
          totalCount={totalCount}
          activeGameId={null}
          hrefFor={routes.listingsFor}
          isCurrentPage={false}
        />
      </div>

      <section aria-labelledby="derniers-depots" className="pt-7">
        {/* Le lien passe sous le titre plutôt que de sortir d'un écran de
            320 px (WCAG 1.4.10). Juste sous le héros, il entre dans la marge
            où Next précharge ce qui arrive à l'écran : comme les
            intercalaires, il attend l'intention, sans quoi chaque visite de
            l'accueil téléchargeait /annonces. */}
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="derniers-depots" className="eyebrow text-[var(--muted)]">
            Déposé récemment
          </h2>
          <IntentLink href={routes.listings} className="group inline-flex shrink-0 items-center gap-1.5 text-[length:var(--text-md)] font-semibold">
            <span className="text-link">Toutes les annonces</span>
            <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
          </IntentLink>
        </div>
        {/* Sous un héros de la hauteur de l'écran : aucune de ces vignettes
            n'est dans le premier écran. Les charger d'emblée retardait les
            polices et la manchette, qui font le LCP de l'accueil. */}
        <ListingGrid listings={recentListings} priorityCount={0} rows={2} />
      </section>
    </div>
  );
}
