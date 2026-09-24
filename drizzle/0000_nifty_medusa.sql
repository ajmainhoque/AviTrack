CREATE TABLE "airports" (
	"ident" text PRIMARY KEY NOT NULL,
	"id" integer NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"elevation_ft" double precision,
	"country" text,
	"region" text,
	"municipality" text,
	"icao_code" text,
	"iata_code" text,
	"gps_code" text,
	"local_code" text,
	"data" jsonb NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airport_frequencies" (
	"id" integer PRIMARY KEY NOT NULL,
	"airport_ident" text NOT NULL,
	"data" jsonb NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navaids" (
	"id" integer PRIMARY KEY NOT NULL,
	"ident" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"airport_ident" text,
	"data" jsonb NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_quota_usage" (
	"key" text PRIMARY KEY NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"code" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runways" (
	"id" integer PRIMARY KEY NOT NULL,
	"airport_ident" text NOT NULL,
	"data" jsonb NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_sync" (
	"source" text PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	"counts" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "airports_iata_idx" ON "airports" USING btree ("iata_code");--> statement-breakpoint
CREATE INDEX "airports_icao_idx" ON "airports" USING btree ("icao_code");--> statement-breakpoint
CREATE INDEX "airports_gps_idx" ON "airports" USING btree ("gps_code");--> statement-breakpoint
CREATE INDEX "airports_local_idx" ON "airports" USING btree ("local_code");--> statement-breakpoint
CREATE INDEX "airports_name_idx" ON "airports" USING btree ("name");--> statement-breakpoint
CREATE INDEX "airports_city_idx" ON "airports" USING btree ("municipality");--> statement-breakpoint
CREATE INDEX "airports_country_idx" ON "airports" USING btree ("country");--> statement-breakpoint
CREATE INDEX "airports_coordinates_idx" ON "airports" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "frequencies_airport_idx" ON "airport_frequencies" USING btree ("airport_ident");--> statement-breakpoint
CREATE INDEX "navaids_airport_idx" ON "navaids" USING btree ("airport_ident");--> statement-breakpoint
CREATE INDEX "navaids_coordinates_idx" ON "navaids" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "runways_airport_idx" ON "runways" USING btree ("airport_ident");