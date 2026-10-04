"use server";

import type { MutationResult } from "@/lib/data/mutation-result";
import { reportContent } from "@/lib/data/report-mutations";
import { collectErrors } from "@/lib/schemas/field-errors";
import { reportSchema } from "@/lib/schemas/report-form";

export async function reportAction(formData: FormData): Promise<MutationResult<null>> {
  const parsed = reportSchema.safeParse({
    targetType: formData.get("targetType"),
    targetKey: formData.get("targetKey"),
    reason: formData.get("reason") ?? undefined,
    details: formData.get("details") ?? "",
  });
  if (!parsed.success) return { status: "invalid", fieldErrors: collectErrors(parsed.error) };
  return reportContent(parsed.data);
}
