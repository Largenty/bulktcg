import "server-only";
import { z } from "@/lib/schemas/zod";

/* Les variables d'environnement du serveur : décrites, vérifiées et lues à
   un seul endroit. instrumentation.ts les contrôle au démarrage du serveur,
   avant la première requête : une configuration fausse doit empêcher le
   site de démarrer, pas le laisser servir des pages à moitié branchées.

   L'adresse publique du site n'est pas ici : le navigateur la lit aussi, et
   lib/site.ts la résout et fait échouer le build d'un vrai déploiement qui
   ne la donne pas. .env.example décrit chaque variable. */

type Env = Record<string, string | undefined>;

/* « NOM= » dans un .env.local vaut une chaîne vide : c'est une variable
   absente, pas une valeur à vérifier. */
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
const httpsUrl = z.string().regex(/^https:\/\/[^\s/]+/, "doit être une adresse absolue en https://");
/* L'adresse d'une photo chez Cloudflare Images : le hash du compte, puis
   l'identifiant et la variante — https://imagedelivery.net/<hash>/{key}/{variant},
   ou sur un domaine personnalisé
   https://<domaine>/cdn-cgi/imagedelivery/<hash>/{key}/{variant}, les deux
   formes que Cloudflare documente. Voir resolvePhotoUrl
   (lib/data/mappers/shared.ts) et le chargeur next/image
   (lib/photo-hosting.ts), qui change la variante selon la largeur
   affichée. Sans le hash, l'adresse ne désigne aucun compte ; un second
   {key} resterait écrit tel quel, buildPhotoUrl ne posant que le premier. */
const photoUrlTemplate = z
  .string()
  .regex(
    /^https:\/\/(?:imagedelivery\.net|[A-Za-z0-9.-]+\/cdn-cgi\/imagedelivery)\/[A-Za-z0-9_-]+\/\{key\}\/\{variant\}$/,
    "doit être https://imagedelivery.net/<hash du compte>/{key}/{variant}, ou https://<domaine>/cdn-cgi/imagedelivery/<hash du compte>/{key}/{variant}",
  );
const secret = z.string().regex(/^\S+$/, "ne doit contenir aucune espace");
/* Le secret que Vercel Cron présente à la tâche quotidienne — le cycle de
   vie des annonces, puis le ménage des photos (Authorization: Bearer …) :
   tiré au hasard, openssl rand -hex 32. */
const cronSecret = z.string().regex(/^\S{32,}$/, "doit compter au moins 32 caractères, sans espace");

/* Des variables qui ne valent que complètes : la moitié d'une configuration
   ferait échouer le premier appel, loin de sa cause. */
const GROUPS = {
  Supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"],
  "Cloudflare Images": [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_IMAGES_API_TOKEN",
    "CLOUDFLARE_IMAGES_SIGNING_KEY",
    "NEXT_PUBLIC_PHOTOS_URL",
  ],
} as const;

const serverEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: optional(httpsUrl),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional(secret),
    SUPABASE_SECRET_KEY: optional(secret),
    CLOUDFLARE_ACCOUNT_ID: optional(secret),
    CLOUDFLARE_IMAGES_API_TOKEN: optional(secret),
    CLOUDFLARE_IMAGES_SIGNING_KEY: optional(secret),
    NEXT_PUBLIC_PHOTOS_URL: optional(photoUrlTemplate),
    CRON_SECRET: optional(cronSecret),
    /* L'API Sirene de l'Insee, facultative : sans elle, une entreprise qui a
       refusé la diffusion de ses données ne se vérifie pas automatiquement
       (lib/company-registry.ts). Clé gratuite, portail-api.insee.fr. */
    INSEE_SIRENE_API_KEY: optional(secret),
    DEMO_USER_ID: optional(z.string().regex(/^u-\d+$/, "désigne un compte de démonstration, « u-13 » par exemple")),
    VERCEL_ENV: optional(z.enum(["production", "preview", "development"])),
  })
  .superRefine((env, context) => {
    for (const [group, names] of Object.entries(GROUPS)) {
      const missing = names.filter((name) => env[name] === undefined);
      const [firstMissing] = missing;
      if (firstMissing !== undefined && missing.length < names.length) {
        context.addIssue({ code: "custom", path: [firstMissing], message: `${group} est configuré à moitié : il manque ${missing.join(", ")}` });
      }
    }
    /* Les fichiers que les cascades laissent chez Cloudflare ne partent que
       par le ménage quotidien, et Vercel Cron ne l'appelle qu'avec ce
       secret : sans lui, ils s'accumuleraient sans que rien ne le dise. */
    if (env.CLOUDFLARE_ACCOUNT_ID !== undefined && env.CRON_SECRET === undefined) {
      context.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "est requis dès que Cloudflare Images est configuré : sans lui, le ménage des photos ne tournerait jamais",
      });
    }
    /* Cloudflare sans Supabase : aucun téléversement ne pourrait être
       inscrit au registre, et le chargeur des photos, branché avec elles,
       enverrait le navigateur chercher les photos de démonstration chez
       Unsplash, que la CSP refuse (img-src) — toutes disparaîtraient. */
    if (isConfigured(env, "Cloudflare Images") && !isConfigured(env, "Supabase")) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
        message:
          "est requis dès que Cloudflare Images est configuré : sans Supabase, aucun téléversement ne pourrait être inscrit au registre, et les photos de démonstration, servies par Unsplash, seraient bloquées par la CSP (img-src)",
      });
    }
    /* Supabase en production sans Cloudflare : les photos des vendeurs
       n'auraient nulle part où vivre. Une prévisualisation ou un poste de
       développement l'admettent : on y essaie la base sans les photos. */
    if (isConfigured(env, "Supabase") && !isConfigured(env, "Cloudflare Images") && isProduction(env)) {
      context.addIssue({
        code: "custom",
        path: ["CLOUDFLARE_ACCOUNT_ID"],
        message:
          "est requis en production dès que Supabase est configuré, avec tout Cloudflare Images : sans lui, toutes les annonces s'afficheraient « Sans photo », et un dépôt avec photos ne pourrait pas être publié",
      });
    }
    if (env.DEMO_USER_ID !== undefined && isRealDeployment(env)) {
      context.addIssue({
        code: "custom",
        path: ["DEMO_USER_ID"],
        message: "est interdit ici : la session de démonstration connecterait chaque visiteur à ce compte",
      });
    }
  });

/* La session de démonstration n'a pas sa place dès que la vraie
   authentification est branchée, ni sur un déploiement de production :
   restée là, une seule variable connecterait tout visiteur anonyme au même
   compte — un contournement complet de l'authentification (audit de
   sécurité, M8). Les prévisualisations et les postes de développement la
   gardent : c'est ainsi qu'on montre la phase 1. */
function isRealDeployment(env: Env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL) || isProduction(env);
}

/* La production, telle que Vercel la nomme ; une prévisualisation, un
   poste de développement ou un build local ne le sont pas. */
function isProduction(env: Env): boolean {
  return env.VERCEL_ENV === "production";
}

/* Un groupe est engagé dès qu'une de ses variables est posée — à moitié, il
   est refusé à part. */
function isConfigured(env: Env, group: keyof typeof GROUPS): boolean {
  return GROUPS[group].some((name) => env[name] !== undefined);
}

/* Chaque problème, en une ligne lisible : le nom de la variable, puis ce
   qui ne va pas. */
export function checkServerEnv(env: Env): string[] {
  const result = serverEnvSchema.safeParse(env);
  return result.success ? [] : result.error.issues.map((issue) => `${String(issue.path[0])} ${issue.message}.`);
}

export function assertServerEnv(env: Env): void {
  const problems = checkServerEnv(env);
  if (problems.length > 0) {
    throw new Error(`Configuration refusée — le serveur ne démarre pas :\n- ${problems.join("\n- ")}\nVoir .env.example.`);
  }
}

/* Le compte de démonstration connecté en phase 1 : DEMO_USER_ID, u-01 (un
   particulier) par défaut. Aucun en production ou une fois la vraie
   authentification branchée — et lever plutôt qu'ignorer la variable
   restée là : le build échoue au lieu de servir le site sous un compte. */
export function resolveDemoUserId(env: Env): string | null {
  if (isRealDeployment(env)) {
    if (env.DEMO_USER_ID) throw new Error(checkServerEnv(env).join("\n"));
    return null;
  }
  return env.DEMO_USER_ID || "u-01";
}

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
  /* Serveur seulement : passe outre la RLS. */
  secretKey: string;
};

/* Supabase tel que la couche données s'en sert en phase 2 : null tant que
   la base n'est pas configurée — le site tourne alors sur ses données de
   démonstration. Une configuration fausse lève, comme au démarrage. */
export function readSupabaseConfig(env: Env): SupabaseConfig | null {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) throw new Error(checkServerEnv(env).join("\n"));
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey, SUPABASE_SECRET_KEY: secretKey } = result.data;
  if (!url || !publishableKey || !secretKey) return null;
  return { url, publishableKey, secretKey };
}

export type CloudflareImagesConfig = {
  accountId: string;
  apiToken: string;
  signingKey: string;
  /* Le gabarit NEXT_PUBLIC_PHOTOS_URL, …/{key}/{variant}. */
  photosUrl: string;
  cronSecret: string;
};

/* Cloudflare Images tel que le serveur s'en sert en phase 2 — adresses de
   dépôt, visibilité, signatures, ménage : null tant que les photos n'y
   sont pas (phase 1). Une configuration fausse lève, comme au démarrage,
   plutôt que de laisser signer avec une clé absente. */
export function readCloudflareImagesConfig(env: Env): CloudflareImagesConfig | null {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) throw new Error(checkServerEnv(env).join("\n"));
  const {
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_IMAGES_API_TOKEN: apiToken,
    CLOUDFLARE_IMAGES_SIGNING_KEY: signingKey,
    NEXT_PUBLIC_PHOTOS_URL: photosUrl,
    CRON_SECRET: cronSecret,
  } = result.data;
  if (!accountId || !apiToken || !signingKey || !photosUrl || !cronSecret) return null;
  return { accountId, apiToken, signingKey, photosUrl, cronSecret };
}

/* Le secret de la tâche quotidienne (src/app/taches/quotidiennes), ou null :
   sans lui, la route refuse tout appel. Le cycle de vie des annonces n'en a
   besoin qu'avec la base — prévenir avant l'échéance, retirer les photos
   d'une annonce archivée ; l'expiration, elle, se lit sur les dates. */
export function readCronSecret(env: Env): string | null {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) throw new Error(checkServerEnv(env).join("\n"));
  return result.data.CRON_SECRET ?? null;
}

/* La clé de l'API Sirene, ou null : la vérification d'un SIRET s'en tient
   alors au répertoire public (Recherche d'entreprises). */
export function readInseeApiKey(env: Env): string | null {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) throw new Error(checkServerEnv(env).join("\n"));
  return result.data.INSEE_SIRENE_API_KEY ?? null;
}
