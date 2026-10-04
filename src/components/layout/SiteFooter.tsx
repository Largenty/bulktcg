import { LogoMark, Wordmark } from "@/components/layout/Logo";
import { ThemeChoiceControl } from "@/components/layout/ThemeChoiceControl";
import { IntentLink } from "@/components/ui/IntentLink";
import { Tranche } from "@/components/layout/Tranche";
import { getCityBySlug } from "@/lib/cities";
import { getGames } from "@/lib/data/games";
import { capitalize } from "@/lib/french";
import { gamePhrases } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { SITE_NAME } from "@/lib/site";

/* Par l'adresse de leur page, pas par leur nom : « valence » est la page de
   Valence (Drôme), celle de Valence (Tarn-et-Garonne) est « valence-82 ». */
const FOOTER_CITIES = ["avignon", "carpentras", "valence", "orange", "montelimar", "cavaillon"].flatMap((slug) => {
  const city = getCityBySlug(slug);
  return city ? [city] : [];
});

export async function SiteFooter() {
  const games = await getGames();

  return (
    <footer className="on-slate mt-auto">
      <Tranche />
      <div className="container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <LogoMark size={44} />
            <p>
              <Wordmark />
              <span className="sr-only">{SITE_NAME}</span>
            </p>
          </div>
          <p className="mt-4 text-[length:var(--text-md)] leading-relaxed text-[var(--chalk-soft)]">
            Les lots, le vrac et le scellé, de la main à la main — entre particuliers, et avec les
            boutiques. Pas d&apos;envoi postal, pas de commission sur les ventes.
          </p>
        </div>

        <FooterColumn title="Par jeu">
          {games.map((game) => (
            <FooterLink key={game.id} href={routes.game(game.id)}>
              {capitalize(gamePhrases(game.id).cards)}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Près de chez vous">
          {FOOTER_CITIES.map((city) => (
            <FooterLink key={city.slug} href={routes.gameCity("pokemon", city.slug)}>
              Pokémon à {city.name}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Le site">
          <FooterLink href={routes.deposit}>Déposer une annonce</FooterLink>
          <FooterLink href={routes.depositWanted}>Déposer une recherche</FooterLink>
          <FooterLink href={routes.wantedListings}>Demandes de recherche</FooterLink>
          <FooterLink href={routes.pro}>Le forfait pro</FooterLink>
          <FooterLink href={routes.safety}>Conseils de sécurité</FooterLink>
          <FooterLink href={routes.signIn}>Se connecter</FooterLink>
          <FooterLink href={routes.legal}>Mentions légales</FooterLink>
        </FooterColumn>
      </div>

      <div className="border-t-[length:var(--border-width)] border-[var(--slate-line)]">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-5">
          <p className="label text-[var(--chalk-muted)]">
            {SITE_NAME} — données de démonstration, aucune annonce réelle
          </p>
          <ThemeChoiceControl />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="label text-[var(--chalk-muted)]">{title}</h2>
      <ul className="mt-4 flex list-none flex-col gap-2.5">{children}</ul>
    </div>
  );
}

/* Une vingtaine de liens, qu'on ouvre rarement : préchargés dès que le pied
   de page arrivait à l'écran — sur chaque page courte, et au bas de chaque
   page longue —, ils téléchargeaient autant de pages. Ils attendent
   l'intention, comme les intercalaires. */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <IntentLink
        href={href}
        className="text-[length:var(--text-md)] text-[var(--chalk-soft)] underline-offset-4 transition-colors hover:text-[var(--chalk)] hover:underline"
      >
        {children}
      </IntentLink>
    </li>
  );
}
