CREATE TYPE "public"."link_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_code" varchar(7) NOT NULL,
	"long_url" text NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "link_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "click_events" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "click_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"link_id" uuid NOT NULL,
	"country" char(2),
	"device_type" varchar(20),
	"referrer" text,
	CONSTRAINT "click_events_id_clicked_at_pk" PRIMARY KEY("id","clicked_at")
) PARTITION BY RANGE ("clicked_at");
--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "links_user_id_idx" ON "links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "click_events_link_time_idx" ON "click_events" USING btree ("link_id","clicked_at");

CREATE TABLE click_events_default PARTITION OF click_events DEFAULT;
CREATE TABLE click_events_2026_11 PARTITION OF click_events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE click_events_2026_12 PARTITION OF click_events
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');