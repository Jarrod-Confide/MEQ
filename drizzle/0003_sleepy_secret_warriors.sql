ALTER TABLE "members" ADD COLUMN "joined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "joined_source" text;