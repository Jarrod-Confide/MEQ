CREATE TABLE "engagement_cache" (
	"window_days" integer PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"duration_ms" integer
);
