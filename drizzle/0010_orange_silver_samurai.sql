ALTER TABLE "staff" ADD COLUMN "regions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Backfill from the single-region column it supersedes.
UPDATE "staff" SET "regions" = jsonb_build_array("region") WHERE "region" IS NOT NULL;--> statement-breakpoint
-- New Global region (code OTHER) is handled by Sean Navarro alongside Southeast.
UPDATE "staff" SET "regions" = '["SE","OTHER"]'::jsonb WHERE "normalized_name" = 'sean navarro';
