import type * as zod from "zod";
import { NEVER, array, boolean, coerce, config, email, enum as enumeration, literal, object, preprocess, string, union, uuid } from "zod";

/* Le seul point d'entrée de Zod dans le projet : schémas, actions serveur et
   crochets de formulaire importent `z` d'ici, jamais de "zod" directement.

   La taille, d'abord. `import { z } from "zod"` lie l'espace de noms entier,
   et avec lui les quarante locales de Zod, que rien n'emploie : le morceau
   des pages de dépôt pesait 62 Ko gzip, quand le même code élagué en pèse
   14. Des imports nommés laissent Turbopack retirer ce qui ne sert pas.
   `z` ne contient donc que ce que le projet emploie : une fonction absente
   est une erreur de type, qu'on corrige en l'ajoutant ici.

   La CSP, ensuite. Zod compile ses analyseurs d'objets avec `new Function`,
   que la politique de sécurité refuse (pas d'unsafe-eval, et c'est voulu) :
   Zod se rabattait sans rien dire, mais le navigateur signalait une
   violation sur chaque page de formulaire. `jitless` supprime la sonde
   elle-même (zod/v4/core/util.js, allowsEval). Posé à l'import de ce
   module, avant qu'un seul schéma soit construit. */
config({ jitless: true });

export const z = {
  NEVER,
  array,
  boolean,
  coerce,
  email,
  enum: enumeration,
  literal,
  object,
  preprocess,
  string,
  union,
  uuid,
};

/* Les types que le code lit sous `z.` — `z.infer<typeof schema>`,
   `z.ZodError`, `z.RefinementCtx` —, dans un espace de noms purement
   déclaratif, effacé à la compilation : il ne tire rien dans le paquet. */
export declare namespace z {
  type infer<T> = zod.infer<T>;
  type ZodError<T = unknown> = zod.ZodError<T>;
  type ZodType<Output = unknown> = zod.ZodType<Output>;
  type RefinementCtx<T = unknown> = zod.RefinementCtx<T>;
}
