CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"metadata" text DEFAULT '{}' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "azure_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"subscription_id" text,
	"resource_group" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"kind" text,
	"location" text,
	"sku" text,
	"tags" text DEFAULT '{}' NOT NULL,
	"raw" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"azure_conversation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"azure_resource_id" uuid NOT NULL,
	"aws_service" text NOT NULL,
	"aws_category" text NOT NULL,
	"confidence" varchar(20) NOT NULL,
	"rationale" text NOT NULL,
	"migration_notes" text DEFAULT '' NOT NULL,
	"alternatives" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"customer_name" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sizing_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"report_type" varchar(20) NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"total_monthly" real DEFAULT 0 NOT NULL,
	"total_annual" real DEFAULT 0 NOT NULL,
	"service_count" integer DEFAULT 0 NOT NULL,
	"metadata" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "azure_resources" ADD CONSTRAINT "azure_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_recommendations" ADD CONSTRAINT "mapping_recommendations_azure_resource_id_azure_resources_id_fk" FOREIGN KEY ("azure_resource_id") REFERENCES "public"."azure_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sizing_reports" ADD CONSTRAINT "sizing_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_user_created" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_event_created" ON "audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_azure_resources_project" ON "azure_resources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_azure_resources_type" ON "azure_resources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_chat_message_chat_id" ON "chat_message" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_chat_user_id" ON "chat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_updated_at" ON "chat" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_mapping_rec_resource" ON "mapping_recommendations" USING btree ("azure_resource_id");--> statement-breakpoint
CREATE INDEX "idx_projects_created_by" ON "projects" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sizing_user_created" ON "sizing_reports" USING btree ("user_id","created_at");