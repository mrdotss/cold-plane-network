/** A chat conversation record. */
export interface ChatConversation {
  id: string;
  userId: string;
  title: string;
  azureConversationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A single chat message. */
export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  attachments: FileRef[];
  createdAt: Date;
}

/** Reference to an uploaded file attachment. */
export interface FileRef {
  id: string;
  name: string;
  type: string;
  size: number;
  extractedText?: string;
}

/** SSE event types emitted by the chat streaming endpoint. */
export type SSEEvent =
  | { type: "delta"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };
