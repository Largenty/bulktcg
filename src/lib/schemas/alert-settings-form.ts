import { z } from "@/lib/schemas/zod";

/* Une case cochée arrive « on », une case vide n'arrive pas. */
const checkbox = z.preprocess((value) => value === "on" || value === true, z.boolean());

export const alertSettingsSchema = z.object({ alertMatches: checkbox, alertMessages: checkbox });
