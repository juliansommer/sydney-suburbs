ALTER TABLE "user_suburbs" DROP CONSTRAINT "user_suburbs_suburb_id_suburbs_id_fk";
--> statement-breakpoint
ALTER TABLE "user_suburbs" ADD CONSTRAINT "user_suburbs_suburb_id_suburbs_id_fk" FOREIGN KEY ("suburb_id") REFERENCES "public"."suburbs"("id") ON DELETE cascade ON UPDATE no action;