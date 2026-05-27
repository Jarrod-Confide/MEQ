CREATE TABLE "member_quality" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text,
	"company" text,
	"company_size" text,
	"employment_status" text,
	"reporting_to" text,
	"seniority" text,
	"team_size" text,
	"employment_type" text,
	"is_fortune_2000" boolean DEFAULT false NOT NULL,
	"is_high_quality" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_quality_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
ALTER TABLE "member_quality" ADD CONSTRAINT "member_quality_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;