CREATE TABLE "member_engagement_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"member_key" text NOT NULL,
	"eventflow_contact_id" uuid,
	"member_id" uuid,
	"name" text,
	"is_member" boolean DEFAULT false NOT NULL,
	"matched" boolean DEFAULT false NOT NULL,
	"territory" text,
	"total" double precision,
	"tier" text,
	"dimensions" jsonb DEFAULT '{}'::jsonb,
	"quality_score" integer,
	"quality_tier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "snapshots_week_idx" ON "member_engagement_snapshots" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "snapshots_territory_idx" ON "member_engagement_snapshots" USING btree ("territory");--> statement-breakpoint
CREATE INDEX "snapshots_member_idx" ON "member_engagement_snapshots" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_week_key_uniq" ON "member_engagement_snapshots" USING btree ("week_start","member_key");