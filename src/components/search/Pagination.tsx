import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { firstParam, type SearchParams } from "@/lib/search-params";

type PaginationProps = {
  basePath: string;
  searchParams: SearchParams;
  currentPage: number;
  pageCount: number;
  pageParam: string;
  /* L'onglet ouvert, quand la liste vit dans un panneau d'onglets. */
  hash?: string;
};

function buildHref(
  basePath: string,
  searchParams: SearchParams,
  pageParam: string,
  page: number,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const first = firstParam(value);
    if (key === pageParam || first === undefined) continue;
    next.set(key, first);
  }
  if (page > 1) next.set(pageParam, String(page));
  const queryString = next.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/* Fenêtre glissante autour de la page courante, premières et dernières
   toujours visibles. Un null représente une coupure. */
function buildWindow(currentPage: number, pageCount: number): Array<number | null> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);

  const result: Array<number | null> = [];
  let previous = 0;
  for (const page of sorted) {
    if (page - previous > 1) result.push(null);
    result.push(page);
    previous = page;
  }
  return result;
}

/* Vraie navigation par liens : la pagination fonctionne sans JavaScript et
   chaque page reste indexable et partageable. */
export function Pagination({
  basePath,
  searchParams,
  currentPage,
  pageCount,
  pageParam,
  hash = "",
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const href = (page: number) => `${buildHref(basePath, searchParams, pageParam, page)}${hash}`;

  const edge =
    "inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] border-[length:var(--border-width)] px-3.5 text-[length:var(--text-md)] font-semibold";

  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {currentPage > 1 ? (
        <Link href={href(currentPage - 1)} rel="prev" className={`${edge} border-[var(--line-strong)] bg-[var(--card)] hover:border-[var(--ink)]`}>
          <Icon name="arrowLeft" size={16} />
          Précédente
        </Link>
      ) : (
        <span aria-hidden="true" className={`${edge} cursor-not-allowed border-[var(--line)] text-[var(--muted)]`}>
          <Icon name="arrowLeft" size={16} />
          Précédente
        </span>
      )}

      {buildWindow(currentPage, pageCount).map((page, index) =>
        page === null ? (
          <span key={`saut-${index}`} aria-hidden="true" className="mono px-1 text-[var(--muted)]">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={href(page)}
            aria-current={page === currentPage ? "page" : undefined}
            aria-label={`Page ${page}`}
            className={`mono grid h-[42px] min-w-[42px] place-items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] px-2 text-[length:var(--text-md)] font-semibold ${
              /* La page courante cernée, pas remplie : l'aplat est réservé aux gestes. */
              page === currentPage
                ? "border-[var(--ink)] bg-[var(--card)] text-[var(--ink)] shadow-[inset_0_0_0_var(--border-width)_var(--ink)]"
                : "border-[var(--line-strong)] bg-[var(--card)] hover:border-[var(--ink)]"
            }`}
          >
            {page}
          </Link>
        ),
      )}

      {currentPage < pageCount ? (
        <Link href={href(currentPage + 1)} rel="next" className={`${edge} border-[var(--line-strong)] bg-[var(--card)] hover:border-[var(--ink)]`}>
          Suivante
          <Icon name="arrowRight" size={16} />
        </Link>
      ) : (
        <span aria-hidden="true" className={`${edge} cursor-not-allowed border-[var(--line)] text-[var(--muted)]`}>
          Suivante
          <Icon name="arrowRight" size={16} />
        </span>
      )}
    </nav>
  );
}
