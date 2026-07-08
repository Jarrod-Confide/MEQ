CREATE TABLE "member_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referred_member_id" uuid NOT NULL,
	"referrer_member_id" uuid,
	"referrer_staff_id" uuid,
	"raw_name" text NOT NULL,
	"normalized_raw" text NOT NULL,
	"status" text NOT NULL,
	"referred_joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_referrals_referred_member_id_unique" UNIQUE("referred_member_id")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"region" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_referrals" ADD CONSTRAINT "member_referrals_referred_member_id_members_id_fk" FOREIGN KEY ("referred_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_referrals" ADD CONSTRAINT "member_referrals_referrer_member_id_members_id_fk" FOREIGN KEY ("referrer_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_referrals" ADD CONSTRAINT "member_referrals_referrer_staff_id_staff_id_fk" FOREIGN KEY ("referrer_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "member_referrals" USING btree ("referrer_member_id");--> statement-breakpoint
CREATE INDEX "referrals_status_idx" ON "member_referrals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_normalized_name_uniq" ON "staff" USING btree ("normalized_name");