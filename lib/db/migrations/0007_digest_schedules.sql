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
ALTER TABLE "digest_schedules" ADD CONSTRAINT "digest_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_digest_schedules_user" ON "digest_schedules" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_digest_schedules_enabled" ON "digest_schedules" USING btree ("enabled","last_run_at");
