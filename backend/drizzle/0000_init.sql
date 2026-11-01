CREATE TYPE "public"."action_type" AS ENUM('check_in', 'payment', 'deposit', 'check_out', 'deposit_refund', 'bed_shift');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('cash', 'upi');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'partial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_phone_unique" UNIQUE("phone"),
	CONSTRAINT "admin_phone_format" CHECK ("admin"."phone" ~ '^[6-9][0-9]{9}$')
);
--> statement-breakpoint
CREATE TABLE "bed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"bed_label" text NOT NULL,
	CONSTRAINT "bed_label_abc" CHECK ("bed"."bed_label" IN ('A', 'B', 'C'))
);
--> statement-breakpoint
CREATE TABLE "building" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"floor_number" integer NOT NULL,
	CONSTRAINT "floor_number_range" CHECK ("floor"."floor_number" BETWEEN 0 AND 200)
);
--> statement-breakpoint
CREATE TABLE "manager" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"current_code_hash" text,
	"code_updated_at" timestamp with time zone,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_building_id_unique" UNIQUE("building_id"),
	CONSTRAINT "manager_phone_unique" UNIQUE("phone"),
	CONSTRAINT "manager_phone_format" CHECK ("manager"."phone" ~ '^[6-9][0-9]{9}$'),
	CONSTRAINT "manager_failed_attempts_range" CHECK ("manager"."failed_attempts" BETWEEN 0 AND 3)
);
--> statement-breakpoint
CREATE TABLE "owner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_phone_unique" UNIQUE("phone"),
	CONSTRAINT "owner_phone_format" CHECK ("owner"."phone" ~ '^[6-9][0-9]{9}$')
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"month" text NOT NULL,
	"amount_due" integer NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_date" date,
	CONSTRAINT "payment_month_format" CHECK ("payment"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "payment_amounts_valid" CHECK ("payment"."amount_due" > 0 AND "payment"."amount_paid" >= 0 AND "payment"."amount_paid" <= "payment"."amount_due"),
	CONSTRAINT "payment_status_matches_amounts" CHECK (
    ("payment"."payment_status" = 'pending' AND "payment"."amount_paid" = 0)
    OR ("payment"."payment_status" = 'partial' AND "payment"."amount_paid" > 0 AND "payment"."amount_paid" < "payment"."amount_due")
    OR ("payment"."payment_status" = 'paid' AND "payment"."amount_paid" = "payment"."amount_due")),
	CONSTRAINT "payment_date_when_paid" CHECK (("payment"."amount_paid" = 0) = ("payment"."payment_date" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_id" uuid NOT NULL,
	"room_number" text NOT NULL,
	"bed_capacity" integer NOT NULL,
	CONSTRAINT "room_bed_capacity_2_or_3" CHECK ("room"."bed_capacity" IN (2, 3))
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"bed_id" uuid,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"age" integer,
	"aadhaar_last4" char(4),
	"monthly_rent" integer NOT NULL,
	"deposit" integer DEFAULT 0 NOT NULL,
	"start_date" date NOT NULL,
	"record_status" "record_status" DEFAULT 'active' NOT NULL,
	"checkout_date" date,
	"deposit_returned" integer,
	"deposit_deduction" integer,
	"created_by_manager_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_phone_format" CHECK ("tenant"."phone" ~ '^[6-9][0-9]{9}$'),
	CONSTRAINT "tenant_age_range" CHECK ("tenant"."age" IS NULL OR "tenant"."age" BETWEEN 14 AND 100),
	CONSTRAINT "tenant_aadhaar_last4_digits" CHECK ("tenant"."aadhaar_last4" IS NULL OR "tenant"."aadhaar_last4" ~ '^[0-9]{4}$'),
	CONSTRAINT "tenant_money_non_negative" CHECK ("tenant"."monthly_rent" > 0 AND "tenant"."deposit" >= 0
    AND COALESCE("tenant"."deposit_returned", 0) >= 0 AND COALESCE("tenant"."deposit_deduction", 0) >= 0),
	CONSTRAINT "tenant_status_bed_consistency" CHECK (
    ("tenant"."record_status" = 'active' AND "tenant"."bed_id" IS NOT NULL AND "tenant"."checkout_date" IS NULL)
    OR ("tenant"."record_status" = 'archived' AND "tenant"."bed_id" IS NULL AND "tenant"."checkout_date" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "transaction_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"manager_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"payment_id" uuid,
	"action_type" "action_type" NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"payment_mode" "payment_mode",
	"rent_month" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "log_amount_non_negative" CHECK ("transaction_log"."amount" >= 0),
	CONSTRAINT "log_mode_for_money_actions" CHECK (
    ("transaction_log"."action_type" IN ('payment', 'deposit', 'deposit_refund')) = ("transaction_log"."payment_mode" IS NOT NULL)),
	CONSTRAINT "log_payment_links_month" CHECK (
    "transaction_log"."action_type" <> 'payment' OR ("transaction_log"."payment_id" IS NOT NULL AND "transaction_log"."rent_month" IS NOT NULL AND "transaction_log"."amount" > 0)),
	CONSTRAINT "log_rent_month_format" CHECK ("transaction_log"."rent_month" IS NULL OR "transaction_log"."rent_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
ALTER TABLE "bed" ADD CONSTRAINT "bed_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building" ADD CONSTRAINT "building_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floor" ADD CONSTRAINT "floor_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager" ADD CONSTRAINT "manager_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager" ADD CONSTRAINT "manager_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_floor_id_floor_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_bed_id_bed_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."bed"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_created_by_manager_id_manager_id_fk" FOREIGN KEY ("created_by_manager_id") REFERENCES "public"."manager"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_log" ADD CONSTRAINT "transaction_log_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_log" ADD CONSTRAINT "transaction_log_manager_id_manager_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."manager"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_log" ADD CONSTRAINT "transaction_log_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_log" ADD CONSTRAINT "transaction_log_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bed_room_label_uq" ON "bed" USING btree ("room_id","bed_label");--> statement-breakpoint
CREATE INDEX "building_owner_idx" ON "building" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "floor_building_number_uq" ON "floor" USING btree ("building_id","floor_number");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_tenant_month_uq" ON "payment" USING btree ("tenant_id","month");--> statement-breakpoint
CREATE INDEX "payment_month_status_idx" ON "payment" USING btree ("month","payment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "room_floor_number_uq" ON "room" USING btree ("floor_id","room_number");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_tenant_per_bed" ON "tenant" USING btree ("bed_id") WHERE "tenant"."record_status" = 'active';--> statement-breakpoint
CREATE INDEX "tenant_building_status_idx" ON "tenant" USING btree ("building_id","record_status");--> statement-breakpoint
CREATE INDEX "log_building_created_idx" ON "transaction_log" USING btree ("building_id","created_at");