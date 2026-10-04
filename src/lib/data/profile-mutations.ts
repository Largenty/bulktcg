import "server-only";
import { getCityByPair } from "@/lib/cities";
import { signOut } from "@/lib/data/auth-mutations";
import type { MutationResult } from "@/lib/data/mutation-result";
import { getProfileById } from "@/lib/data/profiles";
import type { ProfileUpdate } from "@/lib/data/rows";
import { getCurrentUserId } from "@/lib/data/session";
import { performWrite } from "@/lib/data/write-seam";
import type { ProfileValues } from "@/lib/schemas/profile-form";

/* Le profil public du compte connecté, et de personne d'autre : la fonction
   ne prend pas d'identifiant, elle écrit sur la session. */
export async function updateProfile(values: ProfileValues): Promise<MutationResult<{ username: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "unauthenticated" };

  const city = getCityByPair(values.city, values.postalCode);
  /* La fiche boutique n'est écrite que pour un compte professionnel : la
     base refuse de toute façon une fiche sur un compte de particulier. Un
     champ vidé redevient null, pas une chaîne vide. */
  const profile = await getProfileById(userId);
  const shop: ProfileUpdate = profile?.isPro
    ? {
        shop_address: values.shopAddress === "" ? null : values.shopAddress,
        shop_hours: values.shopHours === "" ? null : values.shopHours,
        shop_website: values.shopWebsite === "" ? null : values.shopWebsite,
        cardmarket_url: values.cardmarketUrl === "" ? null : values.cardmarketUrl,
        cardnexus_url: values.cardnexusUrl === "" ? null : values.cardnexusUrl,
      }
    : {};
  const update: ProfileUpdate = {
    username: values.username,
    bio: values.bio === "" ? null : values.bio,
    city: city?.name ?? values.city,
    postal_code: values.postalCode,
    avatar_initials: values.username.replace(/[^a-z0-9]/g, "").slice(0, 2).toUpperCase(),
    ...shop,
  };
  return performWrite(
    "profiles.update",
    { id: userId, profile: update },
    { username: values.username },
    ({ user }) => user.from("profiles").update(update).eq("id", userId).select("id").single(),
    profileFieldErrors,
  );
}

/* Les refus de la base qui visent un champ du formulaire : un pseudo déjà
   pris, une commune inconnue. */
function profileFieldErrors(code: string) {
  if (code === "23505") return { username: "Ce pseudo est déjà pris : choisissez-en un autre." };
  if (code === "23503") return { city: "Choisissez la commune dans la liste proposée." };
  return null;
}

/* La suppression du compte : ses annonces et ses demandes partent avec lui,
   leurs liens cessent de répondre. auth.admin.deleteUser, avec la clé de
   service — aucun rôle connecté ne supprime un compte —, sur l'identifiant
   de la session et jamais un autre ; les suppressions en cascade du schéma
   font le reste (supabase/README.md, § 9). */
export async function deleteAccount(): Promise<MutationResult<null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "unauthenticated" };

  return performWrite("profiles.delete", { id: userId }, null, async ({ admin }) => {
    const deleted = await admin().auth.admin.deleteUser(userId);
    if (deleted.error) return deleted;
    /* Le compte n'existe plus : sa session non plus. Ses cookies partent
       tout de suite, au lieu de survivre jusqu'à l'expiration du jeton — le
       navigateur se croyait encore connecté. signOut efface la session
       locale même quand Auth répond que le compte a disparu. */
    await signOut();
    return { error: null };
  });
}
