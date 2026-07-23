CREATE TABLE "person"."categories" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text DEFAULT '📁' NOT NULL,
	"color" text DEFAULT '#2563EB' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "person"."share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"token" text NOT NULL,
	"mode" text DEFAULT 'public' NOT NULL,
	"share_with" text[],
	"expires_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'Percakapan Baru' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person"."chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "filename" text;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "heading" text;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "sub_heading" text;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "section" text;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "subsection" text;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "parent_heading" text;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "heading_path" text;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "page" integer;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "language" text DEFAULT 'id' NOT NULL;--> statement-breakpoint
ALTER TABLE "person"."chunks" ADD COLUMN "total_chunks" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "person"."documents" ADD COLUMN "expired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person"."documents" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "person"."documents" ADD COLUMN "chunks_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "person"."documents" ADD COLUMN "intelligence_score" jsonb;--> statement-breakpoint
ALTER TABLE "person"."documents" ADD COLUMN "structure_json" jsonb;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;