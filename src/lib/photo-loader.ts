"use client";

import { photoLoaderUrl } from "@/lib/photo-hosting";

/* Le chargeur next/image de la phase 2 : chaque largeur du srcset reçoit la
   variante Cloudflare qui la couvre (lib/photo-hosting), au lieu de faire
   ré-optimiser par Next une image que Cloudflare a déjà ré-encodée — et une
   photo privée ne passe jamais par l'optimiseur, dont le cache est commun à
   tous les lecteurs.

   Il n'est pas branché en phase 1 : un chargeur déclaré dans next.config.ts
   éteint l'optimiseur de Next (/_next/image répond 404), et les photos de
   démonstration, hébergées par Unsplash, en ont besoin. Il se branche avec
   les photos (images.loader « custom », images.loaderFile vers ce fichier)
   dès que NEXT_PUBLIC_PHOTOS_URL est posée : supabase/README.md, § 6. */
export default function photoLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  return photoLoaderUrl(src, width, process.env.NEXT_PUBLIC_PHOTOS_URL);
}
