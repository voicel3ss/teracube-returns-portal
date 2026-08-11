CREATE TABLE "conversation_messages" (
  "id" UUID NOT NULL,
  "replacement_order_id" UUID NOT NULL,
  "sender_kind" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_attachments" (
  "id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "filename" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_messages_replacement_order_id_created_at_idx" ON "conversation_messages"("replacement_order_id", "created_at");
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_replacement_order_id_fkey" FOREIGN KEY ("replacement_order_id") REFERENCES "replacement_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
