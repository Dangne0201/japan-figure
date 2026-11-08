CREATE TYPE "ChatMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL DEFAULT 'Cuộc trò chuyện mới',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "ChatMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_conversations_user_id_updated_at_idx"
ON "chat_conversations"("user_id", "updated_at");

CREATE INDEX "chat_messages_conversation_id_created_at_idx"
ON "chat_messages"("conversation_id", "created_at");

ALTER TABLE "chat_conversations"
ADD CONSTRAINT "chat_conversations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
