"use client";

import { SegmentError } from "@/components/layout/SegmentError";

/* Un onglet du compte qui échoue ne fait pas tomber le compte : l'identité
   et les onglets, dans le gabarit, restent là, et les autres onglets
   fonctionnent. */
export default function AccountError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <SegmentError error={error} retry={retry} subject="Cet onglet" aside="Les autres onglets du compte fonctionnent." />;
}
