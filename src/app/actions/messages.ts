"use server";

import { revalidateMessagePaths } from "@/app/actions/revalidate";
import {
  contactSeller,
  proposeListing,
  sendMessage,
  type ConversationWriteResult,
} from "@/lib/data/message-mutations";
import type { MutationResult } from "@/lib/data/mutation-result";
import { recordIdSchema } from "@/lib/schemas/record-id";
import { collectErrors } from "@/lib/schemas/field-errors";
import { messageSchema } from "@/lib/schemas/message-form";


function readBody(formData: FormData) {
  return messageSchema.safeParse({ body: formData.get("body") ?? "" });
}

export async function contactSellerAction(formData: FormData): Promise<MutationResult<ConversationWriteResult>> {
  const body = readBody(formData);
  if (!body.success) return { status: "invalid", fieldErrors: collectErrors(body.error) };
  const listingId = recordIdSchema.safeParse(formData.get("listingId"));
  if (!listingId.success) return { status: "not-found" };

  const result = await contactSeller({ listingId: listingId.data, body: body.data.body });
  if (result.status === "saved") revalidateMessagePaths(result.data.conversationId);
  return result;
}

export async function proposeListingAction(formData: FormData): Promise<MutationResult<ConversationWriteResult>> {
  const body = readBody(formData);
  const listingId = recordIdSchema.safeParse(formData.get("listingId"));
  if (!body.success || !listingId.success) {
    return {
      status: "invalid",
      fieldErrors: {
        ...(body.success ? {} : collectErrors(body.error)),
        ...(listingId.success ? {} : { listingId: "Choisissez le lot que vous proposez." }),
      },
    };
  }
  const wantedId = recordIdSchema.safeParse(formData.get("wantedId"));
  if (!wantedId.success) return { status: "not-found" };

  const result = await proposeListing({ wantedId: wantedId.data, listingId: listingId.data, body: body.data.body });
  if (result.status === "saved") revalidateMessagePaths(result.data.conversationId);
  return result;
}

export async function sendMessageAction(formData: FormData): Promise<MutationResult<ConversationWriteResult>> {
  const body = readBody(formData);
  if (!body.success) return { status: "invalid", fieldErrors: collectErrors(body.error) };
  const conversationId = recordIdSchema.safeParse(formData.get("conversationId"));
  if (!conversationId.success) return { status: "not-found" };

  const result = await sendMessage({ conversationId: conversationId.data, body: body.data.body });
  if (result.status === "saved") revalidateMessagePaths(result.data.conversationId);
  return result;
}
