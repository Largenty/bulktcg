import Link from "next/link";
import { formatPrice } from "@/lib/format";

/* Sur téléphone, le prix et le geste principal restent sous le pouce
   pendant qu'on lit la description. La page réserve la hauteur de la barre
   en bas, pour que le pied de page ne passe pas dessous. */
export function MobileActionBar({ price, href, label }: { price: number; href: string; label: string }) {
  return (
    <div className="action-bar">
      <span className="price text-[length:var(--number-md)] font-bold">{formatPrice(price)}</span>
      <Link href={href} className="btn flex-1">
        {label}
      </Link>
    </div>
  );
}
