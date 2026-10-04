"use client";

import { SegmentError } from "@/components/layout/SegmentError";

/* Un fil qui échoue ne fait pas tomber la messagerie : la liste des
   conversations, dans le gabarit, reste à côté, et les autres fils
   s'ouvrent. */
export default function MessagesError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <SegmentError error={error} retry={retry} subject="Ce fil" aside="Les autres conversations restent accessibles." />;
}
