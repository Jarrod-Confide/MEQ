CREATE TABLE "admins" (
	"email" text PRIMARY KEY NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expansion_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" text NOT NULL,
	"region" text NOT NULL,
	"quarter_goal" integer DEFAULT 5 NOT NULL,
	"quarter_stretch" integer DEFAULT 7 NOT NULL,
	"year_goal" integer DEFAULT 20 NOT NULL,
	"year_stretch" integer DEFAULT 28 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expansion_cities_city_unique" UNIQUE("city")
);
--> statement-breakpoint
ALTER TABLE "member_engagement_snapshots" ADD COLUMN "signals" jsonb;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_uniq" ON "staff" USING btree ("email");--> statement-breakpoint
-- Seed: Anjie's expansion cities from the v2 plan, and the first admin.
INSERT INTO "expansion_cities" ("city", "region") VALUES
  ('Columbus', 'NE'), ('Cleveland', 'NE'), ('Cincinnati', 'NE'), ('Providence', 'NE'), ('Philadelphia', 'NE')
ON CONFLICT ("city") DO NOTHING;--> statement-breakpoint
INSERT INTO "admins" ("email", "added_by") VALUES ('jarrod@confide.group', 'migration 0012')
ON CONFLICT ("email") DO NOTHING;
