-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('SIMULATED');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "type" "VoucherType" NOT NULL,
    "value" INTEGER NOT NULL,
    "min_subtotal_vnd" INTEGER NOT NULL DEFAULT 0,
    "max_discount_vnd" INTEGER,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "total_limit" INTEGER,
    "per_user_limit" INTEGER,
    "is_stackable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" VARCHAR(40) NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'SIMULATED',
    "recipient_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "street_address" VARCHAR(255) NOT NULL,
    "province_code" VARCHAR(2) NOT NULL,
    "province_name" VARCHAR(120) NOT NULL,
    "commune_code" VARCHAR(5) NOT NULL,
    "commune_name" VARCHAR(120) NOT NULL,
    "commune_type" VARCHAR(30) NOT NULL,
    "carrier_id" VARCHAR(40) NOT NULL,
    "carrier_name" VARCHAR(80) NOT NULL,
    "estimated_delivery_from" DATE NOT NULL,
    "estimated_delivery_to" DATE NOT NULL,
    "subtotal_vnd" INTEGER NOT NULL,
    "voucher_discount_vnd" INTEGER NOT NULL DEFAULT 0,
    "loyalty_discount_vnd" INTEGER NOT NULL DEFAULT 0,
    "shipping_fee_vnd" INTEGER NOT NULL,
    "total_vnd" INTEGER NOT NULL,
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "points_redeemed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_variant_id" VARCHAR(30) NOT NULL,
    "product_slug" VARCHAR(180) NOT NULL,
    "product_name" VARCHAR(240) NOT NULL,
    "variant_name" VARCHAR(120) NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_vnd" INTEGER NOT NULL,
    "weight_grams" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_redemptions" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "loyalty_account_id" TEXT NOT NULL,
    "order_id" TEXT,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points_delta" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE INDEX "vouchers_starts_at_expires_at_idx" ON "vouchers"("starts_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_redemptions_order_id_key" ON "voucher_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "voucher_redemptions_voucher_id_created_at_idx" ON "voucher_redemptions"("voucher_id", "created_at");

-- CreateIndex
CREATE INDEX "voucher_redemptions_user_id_voucher_id_idx" ON "voucher_redemptions"("user_id", "voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_user_id_key" ON "loyalty_accounts"("user_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_loyalty_account_id_created_at_idx" ON "loyalty_transactions"("loyalty_account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_transactions_order_id_type_key" ON "loyalty_transactions"("order_id", "type");

-- Prisma does not yet model partial indexes; enforce one default address per user in PostgreSQL.
CREATE UNIQUE INDEX "addresses_one_default_per_user" ON "addresses"("user_id") WHERE "is_default";

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_loyalty_account_id_fkey" FOREIGN KEY ("loyalty_account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
