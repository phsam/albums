CREATE TABLE "discogs_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"access_token_secret" text NOT NULL,
	"discogs_username" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discogs_tokens_user_id_unique" UNIQUE("user_id")
);
