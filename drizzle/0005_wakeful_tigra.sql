CREATE TABLE "message_scores" (
	"message_id" uuid PRIMARY KEY NOT NULL,
	"source" text,
	"type" text,
	"substance" integer,
	"on_topic" boolean,
	"topics" jsonb DEFAULT '[]'::jsonb,
	"content_weight" double precision,
	"is_connector" boolean DEFAULT false NOT NULL,
	"author_email" text,
	"posted_at" timestamp with time zone,
	"model" text,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "message_scores_author_idx" ON "message_scores" USING btree ("author_email");--> statement-breakpoint
CREATE INDEX "message_scores_connector_idx" ON "message_scores" USING btree ("is_connector");