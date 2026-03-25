CREATE TABLE "azure_resource_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_resource_id" uuid NOT NULL,
	"target_resource_id" uuid NOT NULL,
	"relation_type" varchar(50) NOT NULL,
	"confidence" varchar(20) NOT NULL,
	"method" varchar(30) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "azure_resources" ADD COLUMN "arm_id" text;--> statement-breakpoint
ALTER TABLE "azure_resource_relationships" ADD CONSTRAINT "azure_resource_relationships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "azure_resource_relationships" ADD CONSTRAINT "azure_resource_relationships_source_resource_id_azure_resources_id_fk" FOREIGN KEY ("source_resource_id") REFERENCES "public"."azure_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "azure_resource_relationships" ADD CONSTRAINT "azure_resource_relationships_target_resource_id_azure_resources_id_fk" FOREIGN KEY ("target_resource_id") REFERENCES "public"."azure_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rel_project" ON "azure_resource_relationships" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_rel_source" ON "azure_resource_relationships" USING btree ("source_resource_id");--> statement-breakpoint
CREATE INDEX "idx_rel_target" ON "azure_resource_relationships" USING btree ("target_resource_id");