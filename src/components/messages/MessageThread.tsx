import type { Message } from "@/types/conversation";
import { formatDate, formatTime } from "@/lib/format";

/* Le fil : ses messages à droite, en aplat d'encre ; ceux de l'autre à
   gauche, sur carte. */
export function MessageThread({ messages, viewerId }: { messages: Message[]; viewerId: string }) {
  return (
    <ol className="flex list-none flex-col gap-3">
      {messages.map((message) => {
        const isMine = message.senderId === viewerId;
        return (
          <li key={message.id} className={isMine ? "flex justify-end" : "flex justify-start"}>
            <div
              className={[
                "max-w-[82%] rounded-[var(--radius-lg)] px-4 py-3 sm:max-w-[72%]",
                isMine
                  ? "rounded-br-[var(--radius-sm)] bg-[var(--ink)] text-[var(--on-ink)]"
                  : "rounded-bl-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)]",
              ].join(" ")}
            >
              <p className="whitespace-pre-line text-[length:var(--text-lg)] leading-relaxed">{message.body}</p>
              <p className={`mono mt-1.5 text-[length:var(--text-xs)] ${isMine ? "text-[var(--on-ink-muted)]" : "text-[var(--muted)]"}`}>
                <time dateTime={message.createdAt}>
                  {formatDate(message.createdAt)} à {formatTime(message.createdAt)}
                </time>
                {isMine && message.readAt === null ? " · non lu" : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
