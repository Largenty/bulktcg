/* Générateur pseudo-aléatoire à graine et hachage stable.
   Ce ne sont pas des données factices mais des utilitaires de rendu : les
   blocs photo abstraits doivent produire exactement le même motif côté
   serveur et côté client, sinon l'hydratation diverge. Ils vivent donc ici
   et pas dans lib/mock, qu'aucun composant n'a le droit d'importer. */

export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
