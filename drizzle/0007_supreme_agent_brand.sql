ALTER TABLE "member_quality" ADD COLUMN "email_clicks" integer;--> statement-breakpoint
ALTER TABLE "member_quality" ADD COLUMN "email_last_click_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_quality" ADD COLUMN "email_last_open_at" timestamp with time zone;