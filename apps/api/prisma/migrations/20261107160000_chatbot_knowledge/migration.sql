CREATE TYPE "KnowledgeSourceType" AS ENUM ('DOCUMENT', 'PRODUCT');

CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "source_type" "KnowledgeSourceType" NOT NULL,
    "source_id" VARCHAR(240) NOT NULL,
    "source_title" VARCHAR(300) NOT NULL,
    "source_path" VARCHAR(500),
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "normalized_content" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "metadata" JSONB NOT NULL,
    "embedding" vector(1024),
    "product_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_chunks_chunk_index_check" CHECK ("chunk_index" >= 0)
);

CREATE UNIQUE INDEX "knowledge_chunks_source_type_source_id_chunk_index_key"
ON "knowledge_chunks"("source_type", "source_id", "chunk_index");

CREATE INDEX "knowledge_chunks_source_type_source_id_idx"
ON "knowledge_chunks"("source_type", "source_id");

CREATE INDEX "knowledge_chunks_product_id_idx"
ON "knowledge_chunks"("product_id");

CREATE INDEX "knowledge_chunks_normalized_content_trgm_idx"
ON "knowledge_chunks" USING GIN ("normalized_content" gin_trgm_ops);

ALTER TABLE "knowledge_chunks"
ADD CONSTRAINT "knowledge_chunks_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
