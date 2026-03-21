CREATE TABLE "cfm_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_name" text NOT NULL,
	"aws_account_id" varchar(12) NOT NULL,
	"role_arn" text NOT NULL,
	"external_id" text,
	"regions" jsonb NOT NULL,
	"services" jsonb NOT NULL,
	"last_scan_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cfm_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"service" varchar(50) NOT NULL,
	"resource_id" text NOT NULL,
	"resource_name" text,
	"priority" varchar(10) NOT NULL,
	"recommendation" text NOT NULL,
	"current_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"estimated_savings" numeric(12, 2) DEFAULT '0' NOT NULL,
	"effort" varchar(10) NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cfm_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"summary" jsonb,
	"azure_conversation_id" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "cfm_accounts" ADD CONSTRAINT "cfm_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_recommendations" ADD CONSTRAINT "cfm_recommendations_scan_id_cfm_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."cfm_scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_scans" ADD CONSTRAINT "cfm_scans_account_id_cfm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."cfm_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_scans" ADD CONSTRAINT "cfm_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cfm_accounts_user" ON "cfm_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cfm_accounts_user_aws" ON "cfm_accounts" USING btree ("user_id","aws_account_id");--> statement-breakpoint
CREATE INDEX "idx_cfm_rec_scan" ON "cfm_recommendations" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_cfm_rec_scan_service" ON "cfm_recommendations" USING btree ("scan_id","service");--> statement-breakpoint
CREATE INDEX "idx_cfm_rec_scan_priority" ON "cfm_recommendations" USING btree ("scan_id","priority");--> statement-breakpoint
CREATE INDEX "idx_cfm_scans_account" ON "cfm_scans" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_cfm_scans_user_created" ON "cfm_scans" USING btree ("user_id","created_at");