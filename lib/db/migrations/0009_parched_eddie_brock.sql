CREATE TABLE "aws_account_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aws_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_name" text NOT NULL,
	"aws_account_id" varchar(12) NOT NULL,
	"role_arn" text NOT NULL,
	"external_id" text,
	"regions" jsonb NOT NULL,
	"services" jsonb NOT NULL,
	"group_id" uuid,
	"cost_allocation_tags" jsonb DEFAULT '[]' NOT NULL,
	"last_scan_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aws_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"group_id" uuid,
	"name" varchar(100) NOT NULL,
	"monthly_limit" numeric(12, 2) NOT NULL,
	"alert_threshold_pct" integer DEFAULT 80 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csp_finding_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"resource_id" text NOT NULL,
	"service" varchar(50) NOT NULL,
	"category" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"first_seen_scan_id" uuid NOT NULL,
	"last_seen_scan_id" uuid,
	"acknowledged_at" timestamp,
	"remediated_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csp_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"category" varchar(30) NOT NULL,
	"service" varchar(50) NOT NULL,
	"resource_id" text NOT NULL,
	"resource_name" text,
	"severity" varchar(10) NOT NULL,
	"finding" text NOT NULL,
	"remediation" text NOT NULL,
	"cis_reference" varchar(20),
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csp_scans" (
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
CREATE TABLE "digest_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cron_expression" varchar(50) DEFAULT '0 8 * * 1' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "digest_schedules_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"feature" varchar(10) NOT NULL,
	"filters" jsonb DEFAULT '{}' NOT NULL,
	"sort_by" varchar(50),
	"sort_order" varchar(4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cfm_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "cfm_accounts" CASCADE;--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" DROP CONSTRAINT "cfm_recommendation_tracking_account_id_cfm_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "cfm_scans" DROP CONSTRAINT "cfm_scans_account_id_cfm_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "cfm_schedules" DROP CONSTRAINT "cfm_schedules_account_id_cfm_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD COLUMN "expected_savings" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD COLUMN "actual_savings" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD COLUMN "verification_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "aws_account_groups" ADD CONSTRAINT "aws_account_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aws_accounts" ADD CONSTRAINT "aws_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aws_accounts" ADD CONSTRAINT "aws_accounts_group_id_aws_account_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."aws_account_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aws_budgets" ADD CONSTRAINT "aws_budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aws_budgets" ADD CONSTRAINT "aws_budgets_account_id_aws_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aws_budgets" ADD CONSTRAINT "aws_budgets_group_id_aws_account_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."aws_account_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csp_finding_tracking" ADD CONSTRAINT "csp_finding_tracking_account_id_aws_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csp_finding_tracking" ADD CONSTRAINT "csp_finding_tracking_first_seen_scan_id_csp_scans_id_fk" FOREIGN KEY ("first_seen_scan_id") REFERENCES "public"."csp_scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csp_finding_tracking" ADD CONSTRAINT "csp_finding_tracking_last_seen_scan_id_csp_scans_id_fk" FOREIGN KEY ("last_seen_scan_id") REFERENCES "public"."csp_scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csp_findings" ADD CONSTRAINT "csp_findings_scan_id_csp_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."csp_scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csp_scans" ADD CONSTRAINT "csp_scans_account_id_aws_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csp_scans" ADD CONSTRAINT "csp_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_schedules" ADD CONSTRAINT "digest_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aws_account_groups_user" ON "aws_account_groups" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_aws_account_groups_user_name" ON "aws_account_groups" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "idx_aws_accounts_user" ON "aws_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_aws_accounts_user_aws" ON "aws_accounts" USING btree ("user_id","aws_account_id");--> statement-breakpoint
CREATE INDEX "idx_aws_accounts_group" ON "aws_accounts" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_aws_budgets_user" ON "aws_budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aws_budgets_account" ON "aws_budgets" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_aws_budgets_group" ON "aws_budgets" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_csp_tracking_account" ON "csp_finding_tracking" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_csp_tracking_account_status" ON "csp_finding_tracking" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_csp_tracking_account_resource" ON "csp_finding_tracking" USING btree ("account_id","resource_id","service");--> statement-breakpoint
CREATE INDEX "idx_csp_findings_scan" ON "csp_findings" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_csp_findings_scan_category" ON "csp_findings" USING btree ("scan_id","category");--> statement-breakpoint
CREATE INDEX "idx_csp_findings_scan_severity" ON "csp_findings" USING btree ("scan_id","severity");--> statement-breakpoint
CREATE INDEX "idx_csp_scans_account" ON "csp_scans" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_csp_scans_user_created" ON "csp_scans" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_csp_scans_account_completed" ON "csp_scans" USING btree ("account_id","completed_at");--> statement-breakpoint
CREATE INDEX "idx_digest_schedules_user" ON "digest_schedules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_digest_schedules_enabled" ON "digest_schedules" USING btree ("enabled","last_run_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_saved_views_user" ON "saved_views" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD CONSTRAINT "cfm_recommendation_tracking_account_id_aws_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_scans" ADD CONSTRAINT "cfm_scans_account_id_aws_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_schedules" ADD CONSTRAINT "cfm_schedules_account_id_aws_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;