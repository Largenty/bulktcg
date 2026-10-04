import type { PhotoUploadRow } from "@/lib/data/rows";
import { daysAgo, hoursAgo } from "@/lib/mock/seed";

/* Le registre des téléversements (photo_uploads). Les annonces de
   démonstration montrent des photos d'Unsplash, qui ne sont pas des
   fichiers du site : ces deux lignes sont des dépôts dont le paiement de
   l'option « 8 photos » n'est pas encore venu, au nom de deux comptes, pour
   que le contrôle d'appartenance s'exerce dès la phase 1
   (tests/photo-uploads.test.mjs). */
export const MOCK_PHOTO_UPLOAD_ROWS: PhotoUploadRow[] = [
  { key: "5b0c7e2a-4f1d-4a7e-9c3b-2d8e6f1a0b01", owner_id: "u-01", created_at: hoursAgo(3), detached_at: null, purge_started_at: null },
  { key: "9e4d2c1b-7a3f-4b8e-8d2c-1f0e9a8b7c02", owner_id: "u-03", created_at: daysAgo(1), detached_at: null, purge_started_at: null },
];
