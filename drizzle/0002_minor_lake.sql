ALTER TABLE "member_quality" ADD COLUMN "quality_score" integer;--> statement-breakpoint
ALTER TABLE "member_quality" ADD COLUMN "quality_tier" text;--> statement-breakpoint
ALTER TABLE "member_quality" ADD COLUMN "prominence_score" integer;--> statement-breakpoint
ALTER TABLE "member_quality" ADD COLUMN "authority_score" integer;--> statement-breakpoint
ALTER TABLE "member_quality" ADD COLUMN "team_score" integer;--> statement-breakpoint
ALTER TABLE "member_quality" ADD COLUMN "employment_score" integer;