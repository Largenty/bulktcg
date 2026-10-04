/* La recherche dans la liste des séries du dépôt : par code ou par nom, sans
   tenir compte des accents, de la casse ni de la ponctuation. « mh3 »,
   « bloom », « etincelles » et « ev08.5 » trouvent leur série.

   La ponctuation est retirée, pas remplacée par une espace : « EV08.5 »
   devient « ev085 », que « ev085 » comme « ev08.5 » retrouvent, et
   « l'Horreur » devient « lhorreur », que « horreur » trouve encore. Chaque
   mot de la recherche doit se retrouver quelque part : « modern 3 » trouve
   Modern Horizons 3. */
export function editionSearchKey(text: string): string {
  /* NFD détache l'accent de sa lettre (« é » devient « e » et un accent
     combinant), que le retrait de tout ce qui n'est ni lettre ni chiffre
     emporte ensuite avec la ponctuation. */
  return text
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesEditionQuery(edition: { code: string; name: string }, query: string): boolean {
  const words = editionSearchKey(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${editionSearchKey(edition.code)} ${editionSearchKey(edition.name)}`;
  return words.every((word) => haystack.includes(word));
}

/* Ce que la recherche masque dans la liste d'un jeu. Une série cochée n'est
   jamais masquée : on ne coche pas une case pour la voir disparaître, et
   c'est ce qui garde sous les yeux tout ce qui partira avec l'annonce.
   `matching` compte les séries qui répondent à la recherche, cochées ou
   non. */
export function filterEditions(
  blocks: ReadonlyArray<{ editions: ReadonlyArray<{ id: string; code: string; name: string }> }>,
  query: string,
  checked: ReadonlySet<string>,
): { hidden: Set<string>; matching: number; total: number } {
  const hidden = new Set<string>();
  let matching = 0;
  let total = 0;
  for (const block of blocks) {
    for (const edition of block.editions) {
      total += 1;
      if (matchesEditionQuery(edition, query)) matching += 1;
      else if (!checked.has(edition.id)) hidden.add(edition.id);
    }
  }
  return { hidden, matching, total };
}
