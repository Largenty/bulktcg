import "server-only";
import type { AlertSettings } from "@/lib/data/account-settings";
import type { MutationResult } from "@/lib/data/mutation-result";
import type { AccountSettingsUpdate } from "@/lib/data/rows";
import { getCurrentUserId } from "@/lib/data/session";
import { performWrite } from "@/lib/data/write-seam";

/* Les deux cases d'alerte, et rien d'autre : ce sont les seules colonnes que
   le titulaire modifie (droits, migration 10). Écrit sur la session, jamais
   sur un identifiant venu du navigateur. */
export async function updateAlertSettings(values: AlertSettings): Promise<MutationResult<AlertSettings>> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "unauthenticated" };

  const update: AccountSettingsUpdate = { alert_matches: values.alertMatches, alert_messages: values.alertMessages };
  return performWrite("accountSettings.update", { user_id: userId, settings: update }, values, ({ user }) =>
    user.from("account_settings").update(update).eq("user_id", userId).select("user_id").single(),
  );
}
