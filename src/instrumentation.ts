import type { Instrumentation } from "next";

/* Appelé une fois, au démarrage d'un serveur Next, avant la première
   requête. La configuration y est vérifiée : une variable manquante ou mal
   formée arrête le démarrage avec la liste de ce qui ne va pas, au lieu de
   faire échouer une page au hasard, plus tard, loin de sa cause.

   Le contrôle n'a lieu que dans le runtime Node : c'est le seul où tournent
   les pages et les actions du site. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertServerEnv } = await import("@/lib/env");
    assertServerEnv(process.env);
  }
}

/* Chaque erreur serveur — rendu, action, gestionnaire de route —, en une
   ligne structurée : le chemin, le type de route, et le digest que l'écran
   d'erreur affiche au visiteur (« Référence de l'incident »), pour
   retrouver la trace d'un signalement. Phase 2 : ce point envoie aussi
   l'erreur à la supervision. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      digest,
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
    }),
  );
};
