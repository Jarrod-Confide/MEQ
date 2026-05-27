CREATE TABLE "member_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"contacts_seen" integer DEFAULT 0 NOT NULL,
	"members_upserted" integer DEFAULT 0 NOT NULL,
	"slack_matched" integer DEFAULT 0 NOT NULL,
	"circle_matched" integer DEFAULT 0 NOT NULL,
	"ok" boolean DEFAULT false NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hubspot_contact_id" text,
	"eventflow_contact_id" uuid,
	"slack_user_id" text,
	"circle_member_id" text,
	"email" text,
	"additional_emails" jsonb DEFAULT '[]'::jsonb,
	"first_name" text,
	"last_name" text,
	"display_name" text,
	"company" text,
	"job_title" text,
	"membership_type" text,
	"is_member" boolean DEFAULT false NOT NULL,
	"closest_major_city" text,
	"company_size" text,
	"industry" text,
	"is_fortune_1000" boolean,
	"company_tier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "members_hubspot_contact_id_unique" UNIQUE("hubspot_contact_id"),
	CONSTRAINT "members_eventflow_contact_id_unique" UNIQUE("eventflow_contact_id")
);
--> statement-breakpoint
CREATE INDEX "members_email_idx" ON "members" USING btree ("email");--> statement-breakpoint
CREATE INDEX "members_slack_idx" ON "members" USING btree ("slack_user_id");--> statement-breakpoint
CREATE INDEX "members_circle_idx" ON "members" USING btree ("circle_member_id");