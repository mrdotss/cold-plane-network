-- Phase 3: CSP (Cloud Security Posture) tables

CREATE TABLE IF NOT EXISTS "csp_scans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "aws_accounts"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "summary" jsonb,
  "azure_conversation_id" text,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csp_scans_account" ON "csp_scans" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csp_scans_user_created" ON "csp_scans" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csp_scans_account_completed" ON "csp_scans" USING btree ("account_id","completed_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "csp_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scan_id" uuid NOT NULL REFERENCES "csp_scans"("id") ON DELETE CASCADE,
  "category" varchar(30) NOT NULL,
  "service" varchar(50) NOT NULL,
  "resource_id" text NOT NULL,
  "resource_name" text,
  "severity" varchar(10) NOT NULL,
  "finding" text NOT NULL,
  "remediation" text NOT NULL,
  "cis_reference" varchar(20),
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csp_findings_scan" ON "csp_findings" USING btree ("scan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csp_findings_scan_category" ON "csp_findings" USING btree ("scan_id","category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csp_findings_scan_severity" ON "csp_findings" USING btree ("scan_id","severity");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "csp_finding_tracking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "aws_accounts"("id") ON DELETE CASCADE,
  "resource_id" text NOT NULL,
  "service" varchar(50) NOT NULL,
  "category" varchar(30) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'open',
  "first_seen_scan_id" uuid NOT NULL REFERENCES "csp_scans"("id") ON DELETE SET NULL,
  "last_seen_scan_id" uuid REFERENCES "csp_scans"("id") ON DELETE SET NULL,
  "acknowledged_at" timestamp,
  "remediated_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csp_tracking_account" ON "csp_finding_tracking" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csp_tracking_account_status" ON "csp_finding_tracking" USING btree ("account_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_csp_tracking_account_resource" ON "csp_finding_tracking" USING btree ("account_id","resource_id","service");
