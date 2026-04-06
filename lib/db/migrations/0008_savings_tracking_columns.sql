ALTER TABLE "cfm_recommendation_tracking" ADD COLUMN "expected_savings" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD COLUMN "actual_savings" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "cfm_recommendation_tracking" ADD COLUMN "verification_status" varchar(20) DEFAULT 'pending';
