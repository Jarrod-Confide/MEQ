ALTER TABLE "members" ADD COLUMN "member_number" integer;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_member_number_unique" UNIQUE("member_number");