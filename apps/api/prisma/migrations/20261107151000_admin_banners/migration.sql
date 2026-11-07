CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "image_url" VARCHAR(500) NOT NULL,
    "href" VARCHAR(500) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "banners_is_active_starts_at_ends_at_sort_order_idx" ON "banners"("is_active", "starts_at", "ends_at", "sort_order");

ALTER TABLE "banners" ADD CONSTRAINT "banners_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "banners" ADD CONSTRAINT "banners_valid_window_check" CHECK ("ends_at" > "starts_at");
