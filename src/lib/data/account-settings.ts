import "server-only";
import { cache } from "react";
import { accountSettingsRow } from "@/lib/data/source";

/* Les alertes du compte connecté (/mon-compte/parametres). */
export type AlertSettings = { alertMatches: boolean; alertMessages: boolean };

/* Ce que porte un compte qui vient de naître (account_settings, migration
   3) : les deux alertes cochées. La démonstration n'a pas de réglages en
   mémoire, et les montre ainsi. */
const DEFAULT_ALERTS: AlertSettings = { alertMatches: true, alertMessages: true };

/* Les réglages de la personne connectée, et d'elle seule (source.ts). Une
   lecture en panne lève au lieu de montrer des cases fausses. */
export const getAlertSettings = cache(async (): Promise<AlertSettings> => {
  const row = await accountSettingsRow();
  return row ? { alertMatches: row.alert_matches, alertMessages: row.alert_messages } : DEFAULT_ALERTS;
});
