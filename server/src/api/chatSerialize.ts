import type { Message } from "@prisma/client";

export type ChatMessageDto = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  metadata: unknown | null;
};

export function serializeMessage(row: Message): ChatMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadata ?? null,
  };
}
