CREATE TABLE "member_milestones" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"first_event_at" timestamp with time zone,
	"first_virtual_at" timestamp with time zone,
	"first_post_at" timestamp with time zone,
	"first_reaction_at" timestamp with time zone,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_milestones" ADD CONSTRAINT "member_milestones_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;