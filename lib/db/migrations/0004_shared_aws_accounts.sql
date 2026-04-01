-- Phase 2: Shared AWS Accounts Foundation
-- Rename cfm_accounts → aws_accounts, add account groups, budgets

-- 1. Create aws_account_groups table (before adding FK)
CREATE TABLE IF NOT EXISTS "aws_account_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "name" varchar(100) NOT NULL,
  "description" text,
  "color" varchar(7),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aws_account_groups_user" ON "aws_account_groups" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_aws_account_groups_user_name" ON "aws_account_groups" USING btree ("user_id","name");
--> statement-breakpoint

-- 2. Rename cfm_accounts → aws_accounts (instant, metadata-only operation)
ALTER TABLE "cfm_accounts" RENAME TO "aws_accounts";
--> statement-breakpoint

-- 3. Rename indexes to match new table name
ALTER INDEX IF EXISTS "idx_cfm_accounts_user" RENAME TO "idx_aws_accounts_user";
--> statement-breakpoint
ALTER INDEX IF EXISTS "idx_cfm_accounts_user_aws" RENAME TO "idx_aws_accounts_user_aws";
--> statement-breakpoint

-- 4. Add new columns to aws_accounts
ALTER TABLE "aws_accounts" ADD COLUMN IF NOT EXISTS "group_id" uuid REFERENCES "aws_account_groups"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "aws_accounts" ADD COLUMN IF NOT EXISTS "cost_allocation_tags" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aws_accounts_group" ON "aws_accounts" USING btree ("group_id");
--> statement-breakpoint

-- 5. Create aws_budgets table
CREATE TABLE IF NOT EXISTS "aws_budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "account_id" uuid REFERENCES "aws_accounts"("id") ON DELETE CASCADE,
  "group_id" uuid REFERENCES "aws_account_groups"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "monthly_limit" numeric(12,2) NOT NULL,
  "alert_threshold_pct" integer NOT NULL DEFAULT 80,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aws_budgets_user" ON "aws_budgets" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aws_budgets_account" ON "aws_budgets" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aws_budgets_group" ON "aws_budgets" USING btree ("group_id");
