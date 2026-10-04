import type { ListingPhoto } from "@/types/listing";
import { getStockPhotoByUrl } from "@/lib/photos";

/* Crédit photographe. Unsplash l'exige, et de toute façon une photo de
   démonstration doit dire qu'elle en est une : ces images illustrent
   l'emplacement, elles ne montrent pas le lot réellement mis en vente. */
export function PhotoCredits({ photos }: { photos: ListingPhoto[] }) {
  const credits = new Map<string, string>();
  for (const photo of photos) {
    if (!photo.url) continue;
    const stock = getStockPhotoByUrl(photo.url);
    if (stock) credits.set(stock.username, stock.photographer);
  }

  if (credits.size === 0) return null;

  return (
    <p className="mt-2.5 text-[length:var(--text-sm)] text-[var(--muted)]">
      Photos de démonstration —{" "}
      {[...credits].map(([username, name], index) => (
        <span key={username}>
          {index > 0 ? ", " : ""}
          <a
            href={`https://unsplash.com/@${username}`}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="underline underline-offset-2 hover:text-[var(--ink)]"
          >
            {name}
          </a>
        </span>
      ))}{" "}
      sur{" "}
      <a
        href="https://unsplash.com"
        rel="noopener noreferrer nofollow"
        target="_blank"
        className="underline underline-offset-2 hover:text-[var(--ink)]"
      >
        Unsplash
      </a>
    </p>
  );
}
