CREATE OR REPLACE FUNCTION immutable_unaccent(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, value);
$$;

CREATE TABLE "brands" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "series" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categories" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "name" VARCHAR(240) NOT NULL,
  "character_name" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL,
  "price_vnd" INTEGER NOT NULL,
  "sale_price_vnd" INTEGER,
  "scale" VARCHAR(30),
  "material" VARCHAR(100) NOT NULL,
  "release_date" DATE,
  "jan_code" VARCHAR(20) NOT NULL,
  "is_preorder" BOOLEAN NOT NULL DEFAULT false,
  "preorder_deposit_vnd" INTEGER,
  "is_featured" BOOLEAN NOT NULL DEFAULT false,
  "is_new_arrival" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMPTZ(3),
  "brand_id" TEXT NOT NULL,
  "series_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_price_vnd_check" CHECK ("price_vnd" > 0),
  CONSTRAINT "products_sale_price_vnd_check" CHECK ("sale_price_vnd" IS NULL OR ("sale_price_vnd" > 0 AND "sale_price_vnd" < "price_vnd")),
  CONSTRAINT "products_preorder_deposit_vnd_check" CHECK ("preorder_deposit_vnd" IS NULL OR ("preorder_deposit_vnd" > 0 AND "preorder_deposit_vnd" <= "price_vnd"))
);

CREATE TABLE "product_categories" (
  "product_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_id", "category_id")
);

CREATE TABLE "product_variants" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "sku" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "stock_on_hand" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_variants_stock_on_hand_check" CHECK ("stock_on_hand" >= 0)
);

CREATE TABLE "product_images" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "url" VARCHAR(500) NOT NULL,
  "alt_text" VARCHAR(240) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE UNIQUE INDEX "products_jan_code_key" ON "products"("jan_code");
CREATE INDEX "products_published_at_created_at_idx" ON "products"("published_at", "created_at");
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");
CREATE INDEX "products_series_id_idx" ON "products"("series_id");
CREATE INDEX "products_price_vnd_idx" ON "products"("price_vnd");
CREATE INDEX "products_scale_idx" ON "products"("scale");
CREATE INDEX "products_is_preorder_published_at_idx" ON "products"("is_preorder", "published_at");
CREATE INDEX "product_categories_category_id_idx" ON "product_categories"("category_id");
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");
CREATE UNIQUE INDEX "product_images_product_id_position_key" ON "product_images"("product_id", "position");
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN (immutable_unaccent(lower("name")) gin_trgm_ops);
CREATE INDEX "products_character_name_trgm_idx" ON "products" USING GIN (immutable_unaccent(lower("character_name")) gin_trgm_ops);

ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
