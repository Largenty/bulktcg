import type { z } from "@/lib/schemas/zod";

/* Le premier message de chaque champ, et un seul : sous un champ, on lit une
   correction, pas une liste. Les trois formulaires du site passaient chacun
   par leur copie de cette boucle. */
export function collectErrors<T extends string>(error: z.ZodError): Partial<Record<T, string>> {
  const errors: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as T] = issue.message;
    }
  }
  return errors;
}
