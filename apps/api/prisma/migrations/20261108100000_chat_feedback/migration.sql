CREATE TYPE "ChatFeedbackRating" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

ALTER TABLE "chat_messages"
ADD COLUMN "feedback" "ChatFeedbackRating",
ADD COLUMN "feedback_at" TIMESTAMPTZ(3);
