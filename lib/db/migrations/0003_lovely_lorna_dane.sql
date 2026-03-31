CREATE TABLE "cfm_recommendation_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"resource_id" text NOT NULL,
	"service" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"first_seen_scan_id" uuid NOT NULL,
	"last_seen_scan_id" uuid,
	"acknowledged_at" timestamp,
	"implemented_at" timestamp,
	"verified_at" timestamp,
	"verified_scan_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cfm_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"frequency" varchar(10) NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"hour" integer DEFAULT 6 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cfm_schedules_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD CONSTRAINT "cfm_recommendation_tracking_account_id_cfm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."cfm_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD CONSTRAINT "cfm_recommendation_tracking_first_seen_scan_id_cfm_scans_id_fk" FOREIGN KEY ("first_seen_scan_id") REFERENCES "public"."cfm_scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD CONSTRAINT "cfm_recommendation_tracking_last_seen_scan_id_cfm_scans_id_fk" FOREIGN KEY ("last_seen_scan_id") REFERENCES "public"."cfm_scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD CONSTRAINT "cfm_recommendation_tracking_verified_scan_id_cfm_scans_id_fk" FOREIGN KEY ("verified_scan_id") REFERENCES "public"."cfm_scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_schedules" ADD CONSTRAINT "cfm_schedules_account_id_cfm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."cfm_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfm_schedules" ADD CONSTRAINT "cfm_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cfm_tracking_account" ON "cfm_recommendation_tracking" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_cfm_tracking_account_status" ON "cfm_recommendation_tracking" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cfm_tracking_account_resource" ON "cfm_recommendation_tracking" USING btree ("account_id","resource_id","service");--> statement-breakpoint
CREATE INDEX "idx_cfm_schedules_account" ON "cfm_schedules" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_cfm_schedules_next_run" ON "cfm_schedules" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "idx_cfm_scans_account_completed" ON "cfm_scans" USING btree ("account_id","completed_at");