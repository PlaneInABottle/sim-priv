CREATE TABLE "chatwoot_conversation_consumptions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"chatwoot_conversation_id" bigint NOT NULL,
	"period_key" text NOT NULL,
	"workflow_execution_id" text,
	"consumed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_budget" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"monthly_limit" integer DEFAULT 100 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_budget_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "chatwoot_conversation_consumptions" ADD CONSTRAINT "chatwoot_conversation_consumptions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_budget" ADD CONSTRAINT "workspace_budget_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chatwoot_conv_consumptions_workspace_period_idx" ON "chatwoot_conversation_consumptions" USING btree ("workspace_id","period_key");--> statement-breakpoint
CREATE INDEX "chatwoot_conv_consumptions_recent_idx" ON "chatwoot_conversation_consumptions" USING btree ("workspace_id","chatwoot_conversation_id","consumed_at");