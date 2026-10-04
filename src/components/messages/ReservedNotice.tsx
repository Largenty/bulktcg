import { WaitlistButton } from "@/components/listing/WaitlistButton";
import { isOnWaitlist } from "@/lib/data/waitlist";

/* À la place du champ de réponse, pour qui avait écrit avant la
   réservation : le fil reste lisible, mais le vendeur n'est plus relancé.
   À la place, la liste d'attente. */
export async function ReservedNotice({ listingId, viewerId }: { listingId: string; viewerId: string }) {
  const isWaiting = await isOnWaitlist(listingId, viewerId);
  return (
    <div className="notice flex flex-col gap-3">
      <p className="text-[length:var(--text-md)] leading-relaxed">
        <strong className="font-semibold">Ce lot est réservé pour un autre acheteur.</strong> Vous pouvez relire ce fil,
        mais plus y écrire : le vendeur n&apos;est plus relancé à son sujet. Si la réservation tombe, tous les inscrits
        sont prévenus en même temps.
      </p>
      <WaitlistButton listingId={listingId} isOnWaitlist={isWaiting} />
    </div>
  );
}
