# Project Context
<!-- Generated: 2026-01-08T09:25:37Z | Template Version: 2.0.0 -->
<project_identity>

## Project Information

### Description

Sim Studio - Visual AI agent workflow builder. Build and deploy AI agent workflows in minutes with a drag-and-drop canvas interface. Supports LLM providers, vector databases, integrations, and real-time socket communication.

### Key Technologies

- TypeScript, React 19, Next.js 16 (App Router)
- Bun runtime + Turborepo monorepo
- PostgreSQL + Drizzle ORM + pgvector
- Zustand (state), React Query (data fetching)
- ReactFlow (canvas editor)
- Socket.io (realtime), Vitest (testing)
- Biome (linting/formatting), Better Auth
- Tailwind CSS, shadcn/ui, Radix UI
- Trigger.dev (background jobs), E2B (code execution)

</project_identity>

---

<few_shot_examples>

## Project-Specific Examples

**Good code:**
```typescript
// Absolute imports always
import { useWorkflowStore } from '@/stores/workflows/store'
import { createLogger } from '@sim/logger'

const logger = createLogger('workflow')

interface WorkflowProps { id: string }

export function Workflow({ id }: WorkflowProps) {
  const data = useWorkflowStore((s) => s.workflows[id])
  logger.info('Rendering workflow', { id })
  return <div className={cn('base-class', isActive && 'active')}>{data.name}</div>
}
```

**Bad code:**
```typescript
// Relative imports - NEVER use
import { store } from '../../../stores/workflows/store'
console.log('debug') // Use logger instead
const x: any = {} // No 'any' - use proper types
```

</few_shot_examples>

---

<architecture>

## Architecture Patterns

- **Monorepo**: apps/sim (main), apps/docs, packages/* (db, logger, testing, cli, mcp-server, sdks)
- **State**: Zustand stores in stores/ with devtools middleware
- **Data Fetching**: React Query hooks in hooks/queries/
- **Workflow Engine**: executor/ handles block execution
- **Blocks/Tools/Triggers**: Registries in blocks/, tools/, triggers/
- **Real-time**: Socket.io server in socket/, client connections
- **API Routes**: Next.js app/api/ with route handlers

</architecture>

---

<code_style>

## Code Style Guidelines

- Use absolute imports (@/), never relative
- PascalCase components, use prefix hooks, kebab-case files
- Use `createLogger` from @sim/logger, not console.log
- TypeScript strict: no 'any', explicit types for props/returns
- Tailwind only for styling, use cn() for conditional classes
- Use 'bun' and 'bunx', never npm/npx
- TSDoc for documentation, no // comments or separators
- Biome for linting: 2-space indent, single quotes, no semicolons

</code_style>

---

<file_organization>

## File Organization

```
apps/sim/
├── app/           # Next.js pages + API routes
├── blocks/        # Block definitions + registry
├── components/    # UI components (emcn/, ui/)
├── executor/      # Workflow execution engine
├── hooks/         # React hooks + queries/
├── lib/           # Utilities
├── providers/     # LLM provider integrations
├── stores/        # Zustand stores by feature
├── tools/         # Tool definitions + registry
├── triggers/      # Trigger definitions + registry
└── socket/        # Socket.io realtime server
```

</file_organization>

---

<testing>

## Testing Strategy

- Vitest with @sim/testing package for factories/mocks
- Test files: feature.ts → feature.test.ts (colocated)
- Use @vitest-environment node annotation
- Mock before imports: vi.mock('@sim/db', ...) THEN import
- Use createSession, loggerMock from @sim/testing
- Prefer it.concurrent for parallel tests
- Run: bun run test, bun run test:watch, bun run test:coverage

</testing>

---

<dependencies>

## Dependency Management

- Use workspace packages: @sim/logger, @sim/db, @sim/testing
- Add new deps with: bun add <package>
- Shared deps in root package.json, app-specific in apps/sim/package.json
- Check existing utils in lib/ before creating new ones
- React 19, Next.js 16 canary - stay on these versions

</dependencies>

---

<development_workflow>

## Development Workflow

1. Development: bun run dev:full (app + sockets)
2. Lint/Format: bun run lint, bun run format
3. Type Check: bun run type-check
4. Test: bun run test
5. Build: bun run build
6. DB Migrations: cd packages/db && bunx drizzle-kit migrate

</development_workflow>

---

<implementation_guidelines>

## Implementation Guidelines

### Creating Workflows with Sim

Sim is an open-source visual workflow builder for creating and deploying AI agent workflows. Workflows are composed of **Blocks** connected together through **Edges** (connections) that define data flow.

#### Workflow Structure: Inputs, Processing, Outputs

Every workflow follows a fundamental pattern:

```
[TRIGGER/INPUT] → [PROCESS] → [OUTPUT]
```

#### 1. Entry Points (Triggers)

Workflows start with trigger blocks that receive input. Reference them using their **block name**:

**Start Block** - Default entry point for chat/UI input
- Syntax: `<Start.input>` - References user input from chat interface
- Outputs: User message text
- Use Case: Interactive conversations, chat-based workflows

**Webhook Block** - Receive data from external services
- Syntax: `<Webhook 1.fieldName>` - Access webhook payload fields
- Example Fields: `conversationId`, `message`, `tracking_id`, `user_email`
- Example Usage: `<Webhook 1.conversationId>`, `<Webhook 1.message>`, `<Webhook 1.tracking_id>`
- Outputs: POST/GET request data, headers, query parameters
- Use Case: Real-time integrations, event-driven workflows

**Service Triggers** - Event-driven triggers from specific platforms
- Slack, GitHub, Airtable, Google Forms, etc.
- Trigger mode enabled on any service block
- Reference by block name: `<Slack.event>`, `<GitHub.action>`
- Outputs: Event-specific structured data

#### 2. Processing Blocks

Blocks are building blocks that perform actions or transformations:

**Agent Block** - AI-powered processing
```
Input: User message/data
Process: LLM reasoning with optional tools
Output: <Agent 1.content>, <Agent 1.tokens>, <Agent 1.toolCalls>
```

Example workflow step:
```
<Start.input> → Agent Block → <Agent 1.content>
```

**Router Block** - Intelligent routing based on content analysis
- Uses AI to classify intents and route to different paths
- Outputs: `<Intent Classifier.selectedPath>` (selected destination block name)
- Different from Condition blocks which use rule-based logic
- Example routes: "cargo_tracking" vs "other"
- Best models: Claude 3.7 Sonnet, GPT-4o for reasoning capabilities

```
<Start.input> → Intent Classifier → Cargo API (if cargo_tracking) → Email
                                  → Other Handler (if other)
```

**API Block** - Call external REST APIs
- Subblocks: url, method (GET/POST/PUT), headers, params, body
- Outputs: `<Cargo API.response>` (full response), status codes
- Example Yurtici Kargo tracking API:
```json
{
  "url": "https://www.yurticikargo.com/service/shipmentstracking",
  "method": "GET",
  "params": [
    { "key": "id", "value": "311861947611" },
    { "key": "language", "value": "tr" }
  ],
  "headers": {
    "Accept": "application/json",
    "User-Agent": "WorkflowBot/1.0"
  }
}
```

**Gmail Block** - Send email notifications
- Subblocks: to, from, subject, body, isHtml
- Syntax: `{{variable}}` for template interpolation
- Example: `{{variable.user_email}}`, `{{Webhook 1.user_email}}`
- Outputs: `<Gmail.sent>` (boolean), message ID
- Example:
```
To: {{variable.user_email}}
Subject: Cargo Tracking Results - {{Webhook 1.tracking_id}}
Body: Your cargo status: {{Cargo API.response.ShipmentStatus}}
      Delivery Date: {{Cargo API.response.DeliveryDate}}
```

**Agent Block with Tools** - AI with integrated service tools
- Subblocks: model, tools, system prompt, messages
- Tools can include HTTP API, Exa Search, Linkup, etc.
- Outputs: `<Agent 1.content>` (response), `<Agent 1.toolCalls>` (which tools were used)

**Condition Block** - Rule-based branching
- Use for simple logic: if value > 10, string equals, etc.
- Outputs: True/False routing

#### 3. Data Flow & Variable References

**Block Output Syntax (using block names):**
```
<BlockName.outputField>
<Start.input>                          # User input from chat
<Webhook 1.conversationId>             # Webhook field
<Webhook 1.message>                    # Message from webhook
<Webhook 1.tracking_id>                # Tracking ID from webhook
<Agent 1.content>                      # Agent's text response
<Agent 1.tokens>                       # Token usage stats
<Cargo API.response>                   # Full API response
<Cargo API.response.status>            # HTTP status code
<Intent Classifier.selectedPath>       # Chosen route destination
```

**Template Variables in Text/Email Blocks:**
```
Subject: Cargo Tracking Results - {{Webhook 1.tracking_id}}
Body: Status: {{Cargo API.response.ShipmentStatus}}
      Delivery Date: {{Cargo API.response.DeliveryDate}}
      Location: {{Cargo API.response.DeliveryCityName}}
```

**Workflow Variables:**
```
Variables can be defined and referenced across workflow
Variable Type: string, number, boolean, object, array
Reference: <variable.variableName> in block outputs and prompts
           {{variable.user_email}} in email blocks and templates
           {{variable.tracking_id}} in API params and headers
```

#### 4. Complete Workflow Example: Cargo Tracking

**Scenario:**
- Webhook receives chat message with tracking ID and user email
- Router classifies intent (cargo tracking or other)
- If cargo tracking: Call Yurtici Kargo API to fetch tracking status
- Email sends results with delivery details to user
- If other: Route to alternative handler

**Workflow Structure:**

```
Chat Message (Webhook 1)
    ↓
Intent Classifier (Router - AI classifies message)
    ↓
├─→ Cargo Tracking Path
│   ├─→ Cargo API (GET shipment status)
│   └─→ Email Notification (Send results)
│
└─→ Other Requests Path (Fallback)
```

**Blocks:**

1. **Webhook Trigger Block - "Webhook 1"**
   - Path: `/cargo-tracking`
   - Method: POST
   - Receives: `message`, `tracking_id`, `user_email`, `conversationId`
   - Output fields: `<Webhook 1.conversationId>`, `<Webhook 1.message>`, `<Webhook 1.tracking_id>`, `<Webhook 1.user_email>`

2. **Intent Router - "Intent Classifier" (Router block)**
   - Model: GPT-4o-mini or Claude 3.7 Sonnet
   - Input Prompt: `User message: <Webhook 1.conversationId>`
   - Routes:
     - "cargo_tracking": Route to Cargo API
     - "other": Route to fallback
   - Output: `<Intent Classifier.selectedPath>` (the selected route name)

3. **API Block - "Cargo API"**
   - Method: GET
   - URL: `https://www.yurticikargo.com/service/shipmentstracking`
   - Params:
     - id: `<Webhook 1.tracking_id>` or `<variable.tracking_id>`
     - language: `tr`
   - Headers:
     - Accept: `application/json`
     - User-Agent: `WorkflowBot/1.0`
   - Error Handling: 3 retries, 1s delay, 30s timeout
   - Output: `<Cargo API.response>` (full response with tracking details)

4. **Email Block - "Email Notification"**
   - To: `{{Webhook 1.user_email}}` or `{{variable.user_email}}`
   - From: `noreply@cargotracking.com`
   - Subject: `Cargo Tracking Results - {{Webhook 1.tracking_id}}`
   - Body (HTML template):
   ```html
   <h2>Cargo Tracking Details</h2>
   <p><strong>Status:</strong> {{Cargo API.response.ShipmentStatus}}</p>
   <p><strong>Delivery Date:</strong> {{Cargo API.response.DeliveryDate}}</p>
   <p><strong>From:</strong> {{Cargo API.response.DepartureCityName}}</p>
   <p><strong>To:</strong> {{Cargo API.response.DeliveryCityName}}</p>
   <p><strong>Receiver:</strong> {{Cargo API.response.Receiver}}</p>
   ```
   - isHtml: `true`

**Block Connections (Edges):**
```
Webhook 1 (output) → Intent Classifier (input)
Intent Classifier (route-cargo) → Cargo API (input)
Cargo API (output) → Email Notification (input)
```

**Workflow Variables:**
```
var-tracking-id: string = "311861947611"
var-user-email: string = "customer@example.com"
```

#### 5. Best Practices for Workflow Creation

**Data Flow Design:**
- Always map output from previous blocks using `<BlockName.field>` syntax (not block ID)
- Use templates `{{}}` for string interpolation in text/email blocks
- Variable references: `<variable.variableName>` in code, `{{variable.variableName}}` in templates
- Validate data at each step before passing to next block

**Block Configuration:**
- **Webhook blocks**: Configure expected payload schema with required fields
- **Router blocks**: Use Claude 3.7 Sonnet or GPT-4o for best intent classification accuracy
- **Agent blocks**: Provide clear system/user prompts, select appropriate model
- **API blocks**: Handle errors with retry logic (3-5 retries), validate response structure
- **Email blocks**: Use HTML formatting for better presentation, test templates with sample data

**Error Handling:**
- Configure retry attempts for API calls (3-5 retries with exponential backoff)
- Set appropriate timeout values (30s for external services)
- Use fallback paths in routers for unclassified intents
- Test with diverse inputs to verify routing accuracy
- Monitor token usage and costs for AI operations

**Testing & Debugging:**
- Use Chat panel to test workflows in real-time
- Select different output options to debug intermediate blocks
- Review execution logs for routing decisions and token usage
- Monitor performance metrics in workflow dashboard
- Test edge cases: empty inputs, malformed data, API errors

#### 6. Advanced Features

**Agent Tools Configuration:**
```
Agents can use integrated tools:
- HTTP API calls (GET, POST, PUT, DELETE)
- Search tools (Exa, Linkup, Google Search)
- Database queries (PostgreSQL, Supabase)
- Document processing (Firecrawl)
- Email operations (Gmail, Outlook)
```

**Subblock Updates (Programmatic Configuration):**
```
Use sim-mcp-update_subblock to modify individual fields:
- Agent tools configuration (add/update/remove tools)
- API block headers, params, authentication
- Email template content
- Router model selection and routes
```

**Workflow Variables:**
```
Add persistent variables for:
- User emails, IDs, API keys, tokens
- Default parameter values
- Configuration settings
- Query parameters, request headers
Reference: {{variable.variableName}} anywhere in blocks
```

**Real-time Collaboration:**
- Multiple users can edit workflows simultaneously
- Live updates on canvas
- Granular permission controls

#### 7. Integration Examples

**Web Search Agent:**
```
<Start.input> → Search Agent (with Exa/Linkup tools) → Structured JSON response
```

**Support Ticket Router:**
```
<Start.input> → Ticket Router → Engineering Agent / Finance Agent / Sales Agent
```

**Event-Driven Automation (from external service):**
```
<Webhook.event> → Condition/Router → Database Update / Email / Slack Message
```

**Multi-Step Processing Pipeline:**
```
<Start.input> → Agent 1 → API Call → Agent 2 (Format) → Email → Success Response
```

**Cargo Tracking (Real Example):**
```
<Webhook 1: tracking_id + user_email + conversationId>
    → Intent Classifier (AI routes cargo tracking)
    → Cargo API (Yurtici Kargo shipment tracking)
    → Email Notification (Delivery status to customer)
    → Success response
```

#### 8. MCP Server Tools for Workflow Management

Use sim-mcp tools to programmatically create and manage workflows:

```typescript
// List existing workflows in workspace
sim-mcp-list_workflows(workspaceId)

// Export workflow for inspection/backup
sim-mcp-export_workflow(workflowId)

// Create new blocks in workflow
sim-mcp-add_blocks(workflowId, blocks[], edges[])

// Update block configuration
sim-mcp-update_block_name(workflowId, blockId, name)
sim-mcp-toggle_block_enabled(workflowId, blockId, enabled)

// Update subblock values (API url, email template, etc)
sim-mcp-update_subblock(workflowId, blockId, subblockId, value)

// Connect blocks with edges
sim-mcp-add_edge(workflowId, sourceId, targetId, sourceHandle, targetHandle)
sim-mcp-remove_edge(workflowId, edgeId)

// Add workflow variables
sim-mcp-add_variable(workflowId, name, type, value)
sim-mcp-remove_variable(workflowId, variableId)

// Replace entire workflow state (for batch updates)
sim-mcp-replace_workflow_state(workflowId, state)

// Remove blocks
sim-mcp-remove_blocks(workflowId, blockIds[])
```

#### 9. Defining Object Schemas

When defining webhook input formats or API request/response schemas, use the correct JSON Schema format with quoted field names and proper property structures.

**CORRECT Format:**
```json
{
  "id": {
    "type": "number",
    "description": "Unique identifier"
  },
  "status": {
    "type": "string",
    "description": "Current status"
  },
  "meta": {
    "type": "object",
    "description": "Metadata object",
    "properties": {
      "sender": {
        "type": "object",
        "description": "Sender information",
        "properties": {
          "id": {
            "type": "number",
            "description": "Sender user ID"
          },
          "email": {
            "type": "string",
            "description": "Sender email address"
          }
        }
      }
    }
  }
}
```

**Key Rules:**
1. All field names must be quoted strings (e.g., `"id"`, not `id`)
2. Each field must have a `type` property
3. Add `description` for clarity
4. Nested objects use `properties` to define child fields
5. Do NOT include `name` or `id` properties as field definitions - use them only for internal Sim block tracking

**INCORRECT Format (avoid):**
```json
{
  id: { type: "number" },              // ❌ Unquoted field name
  "meta": {
    "type": "object",
    "name": "meta",                    // ❌ Don't add 'name' here
    "id": "field-meta",                // ❌ Don't add 'id' here
    "value": [...]                     // ❌ Don't mix formats
  }
}
```

**Using in Webhooks:**
```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "generic_webhook",
    name: "Message Webhook",
    position: { x: 100, y: 100 },
    data: {
      inputFormat: {
        "event": {
          "type": "string",
          "description": "Event type identifier"
        },
        "id": {
          "type": "number",
          "description": "Message ID"
        },
        "conversation": {
          "type": "object",
          "description": "Conversation context",
          "properties": {
            "id": {
              "type": "number",
              "description": "Conversation ID"
            },
            "status": {
              "type": "string",
              "description": "Conversation status"
            }
          }
        },
        "attachments": {
          "type": "array",
          "description": "File attachments"
        }
      }
    }
  }]
})
```

#### 9b. Defining Array Schemas

Arrays in Sim use a special format - the value is wrapped in `[]` brackets containing the item object definition.

**Array Format:**
```json
{
  "attachments": {
    "type": "array",
    "description": "Array of attachments",
    // The value uses [] with object definition inside
    "value": [
      {
        "type": "object",
        "description": "Attachment item",
        "properties": {
          "id": {
            "type": "number",
            "description": "Attachment ID"
          },
          "filename": {
            "type": "string",
            "description": "File name"
          },
          "size": {
            "type": "number",
            "description": "File size in bytes"
          },
          "mime_type": {
            "type": "string",
            "description": "MIME type"
          }
        }
      }
    ]
  }
}
```

**Key Rules for Arrays:**
1. Array field itself has `"type": "array"`
2. The `value` property contains `[{ ... }]` with the item schema inside brackets
3. Item schema includes all properties that each array element will have
4. Each property follows the same object/property rules
5. Can contain nested objects within array items

**Using in MCP Tools:**
```javascript
sim-mcp-update_subblock({
  workflowId: "wf_123",
  blockId: "webhook_1",
  subblockId: "inputFormat",
  value: [
    // ... other fields ...
    {
      "id": "field-attachments",
      "name": "attachments",
      "type": "array",
      "collapsed": false,
      "value": "[{\n  \"type\": \"object\",\n  \"description\": \"Attachment object\",\n  \"properties\": {\n    \"id\": { \"type\": \"number\", \"description\": \"ID\" },\n    \"filename\": { \"type\": \"string\", \"description\": \"Name\" },\n    \"size\": { \"type\": \"number\", \"description\": \"Size\" }\n  }\n}]"
    }
  ]
})
```

Note: When using in MCP tools, the array value is a **string** containing JSON (not a JavaScript array).

#### 10. Documentation References

**Sim Core Documentation:**
- **Introduction**: Open-source visual workflow builder with 80+ native integrations
- **Getting Started**: Build a people research agent in 10 minutes - demonstrates Start block, Agent block with tools, structured outputs
- **Router Block**: AI-powered intent classification and routing (different from rule-based Condition blocks)
- **Webhook Triggers**: Generic webhooks for any payload + service-specific triggers for Slack/GitHub/etc

**Block Types:**
- Start (entry point from chat)
- Agent (AI processing with optional tools)
- Router (AI-powered routing)
- API (REST API calls with templating)
- Gmail/Email (send notifications)
- Condition (rule-based branching)
- Database blocks (query/insert/update operations)
- Transform/Code blocks (custom logic)

**Tool Integration:**
- 80+ native services: Gmail, Slack, GitHub, Airtable, databases
- HTTP API tool for custom endpoints
- Search tools: Exa, Linkup, Google Search
- Database tools: PostgreSQL, MySQL, Supabase, Pinecone
- Document processing: Firecrawl for web scraping

</implementation_guidelines>

---

<integrations>

## Integrations & SDKs

### LLM Providers (apps/sim/providers/*)

Sim Studio supports **14 LLM providers** across 4 categories:

**Core Providers (4)**
- **OpenAI**: GPT-4o, GPT-4-turbo, o1/o3 reasoning models with structured output + tool calling
- **Anthropic**: Claude 3.5/4 Sonnet, Claude 3 Opus/Haiku with computer use + extended thinking
- **Google (Gemini)**: Gemini 2.0/1.5 Pro/Flash with multimodal + code execution
- **Vertex AI**: Google Cloud-hosted Gemini models with enterprise credentials

**Cloud/Enterprise Providers (2)**
- **Azure OpenAI**: Microsoft-hosted OpenAI models with Azure AD authentication
- **AWS Bedrock**: Amazon-hosted Claude, Titan, Llama models with IAM credentials

**High-Throughput Inference (5)**
- **Mistral AI**: Mistral Large, Medium, Codestral for code generation
- **Groq**: Ultra-fast inference with Llama, Mixtral, Gemma models
- **Cerebras**: Wafer-scale accelerated inference
- **Deepseek**: Deepseek-V3 and reasoning models
- **xAI**: Grok models with real-time knowledge

**Gateways & Self-Hosted (3)**
- **OpenRouter**: Unified API routing to 200+ models with fallback support
- **vLLM**: Self-hosted OpenAI-compatible inference server
- **Ollama**: Local model execution for privacy-first deployments

> **Note**: Beyond the ~50 highlighted blocks below, Sim Studio provides **80+ native blocks** for integrations across email, databases, search, analytics, automation, and AI/media services.

### OAuth SaaS Integrations (apps/sim/lib/oauth/oauth.ts)
- **Google**: Gmail, Drive, Docs, Sheets, Forms, Calendar, Vault, Groups, Vertex AI.
- **Microsoft**: Outlook, Teams, OneDrive, SharePoint, Excel, Planner.
- **Work Management**: Jira + JSM, Confluence, Linear, Trello, Asana.
- **CRM & Sales**: HubSpot, Salesforce, Pipedrive, Wealthbox, Shopify.
- **Comms & Social**: Slack, GitHub, X, Reddit, LinkedIn, Zoom.
- **Content & Files**: Airtable, Notion, Dropbox, Webflow, WordPress, Spotify.

### Native Blocks & Tools (apps/sim/blocks/blocks/*)
- **Email & Messaging**: Gmail, Outlook, SMTP, Resend, SendGrid, Mailgun, Mailchimp, Slack, Discord, Telegram, WhatsApp, Twilio SMS/Voice.
- **Search & Web Data**: Exa, Tavily, Serper, Linkup, DuckDuckGo, Wikipedia, arXiv, Perplexity, YouTube, Firecrawl.
- **Databases & Storage**: PostgreSQL, MySQL, MongoDB, DynamoDB, RDS, Supabase, Pinecone, Qdrant, S3, SharePoint, OneDrive, SFTP/SSH.
- **Observability & Analytics**: PostHog, Sentry, Datadog, Grafana, LangSmith.
- **Automation & Apps**: Zendesk, ServiceNow, Intercom, Calendly, Typeform, GitHub, GitLab, Shopify, Stripe, Zoom.
- **AI & Media**: OpenAI, HuggingFace, Vision, Image Generator, Video Generator, ElevenLabs, STT/TTS.

### SDKs, CLI, and MCP
- **TypeScript SDK (`simstudio-ts-sdk`)**: Execute workflows programmatically from JS/TS apps.
- **Python SDK (`simstudio-sdk`)**: Execute workflows from Python apps with sync helpers.
- **CLI (`simstudio`)**: Run Sim locally via Docker for development.
- **MCP Server (`packages/mcp-server`)**: Programmatic workflow management with sim-mcp tools.

</integrations>

---

## Key Resources

- **AGENTS.md** (this file): Complete guide for building Sim workflows with examples and best practices
- **CLAUDE.md**: Development standards and code style guidelines
- **.claude/skills/sim-api-management/**: Webhook and API configuration guides
- **.claude/skills/sim-workflows/**: Programmatic workflow management with MCP tools
- **.claude/skills/sim-tools-integration/**: Tool schema and parameter mapping reference

---

## Last Verified

2026-01-16

---

## Available Claude Skills

The `.claude/skills/` directory contains specialized knowledge modules for different aspects of Sim Studio development and workflow creation. Use the `skill` tool to invoke these when working on specific tasks.

### Workflow Management & Development

**sim-workflows**
- Building and modifying workflows programmatically via MCP tools
- Adding/removing blocks, connecting edges, managing workflow state
- Importing/exporting workflows and automating workflow creation
- Comprehensive guide for all sim-mcp operations, block types, variables, subflows, templates

**sim-api-management**
- Configuring API triggers and REST endpoints
- Setting up webhooks and implementing API best practices
- Input/output schema design and request/response patterns
- Webhook authentication, payload formats, and debugging

**sim-agents-advanced**
- Configuring advanced agent settings and model selection
- System prompts, tool binding, and context management
- Token optimization and prompt engineering
- Knowledge base integration and semantic search

### Integration & Tools

**sim-tools-integration**
- Integrating external tools and services (Discord, Slack, Teams, Gmail, S3, PostgreSQL, Linear, etc.)
- Configuring authentication and mapping parameters
- Understanding tool schemas and output structures
- Service-specific configuration patterns

**sim-auth-security**
- Configuring OAuth integrations and setting up BYOK (Bring Your Own Key)
- Managing API keys and implementing security best practices
- Troubleshooting authentication issues
- Security patterns for Sim workflows

**sim-knowledge-bases**
- Building RAG (Retrieval Augmented Generation) workflows
- Setting up knowledge bases and configuring document chunking
- Implementing semantic search and optimizing retrieval relevance
- Knowledge base performance tuning

### Monitoring & Optimization

**sim-execution-monitoring**
- Debugging workflows and analyzing execution logs
- Monitoring performance metrics and handling errors
- Troubleshooting workflow issues with execution API reference
- Performance debugging patterns and optimization tips

**sim-billing-optimization**
- Optimizing LLM costs and analyzing token usage
- Comparing model pricing and implementing caching strategies
- Setting up cost monitoring and alerts
- Reducing execution costs in Sim workflows

**billing-essentials**
- Complete guide to Sim Studio's billing and usage tracking system
- Cost calculation, token extraction, and subscription management
- Usage limits, overage billing, and Stripe integration
- Usage monitoring UI and billing-related features

### Deployment & Infrastructure

**deployment-guide**
- Creating and optimizing Dockerfiles
- Configuring Docker Compose for multi-container development
- Setting up Render.com Blueprints for production deployment
- Kubernetes/Helm deployment, build error troubleshooting, health checks

**sim-upstream-sync**
- Keeping a forked Sim repo up-to-date with upstream (sim-origin/main)
- Rebase-first workflow for syncing changes from upstream
- Conflict resolution strategies, especially for bun.lock files
- Safe force-push patterns with --force-with-lease
- Syncing origin/main from updated develop branch

### Skill Development

**skill-creator**
- Creating and managing custom AI skills
- Modular skill packages for specialized knowledge and workflows
- Tool integrations and domain-specific expertise
- Packaging skills for reuse and distribution

---

## When to Use Each Skill

| Task | Skill |
|------|-------|
| Build/modify workflows programmatically | sim-workflows |
| Create webhooks and API endpoints | sim-api-management |
| Configure AI agents and models | sim-agents-advanced |
| Integrate external services | sim-tools-integration |
| Set up authentication and security | sim-auth-security |
| Build RAG applications | sim-knowledge-bases |
| Debug and monitor workflows | sim-execution-monitoring |
| Optimize costs and LLM usage | sim-billing-optimization, billing-essentials |
| Deploy to production | deployment-guide |
| Sync fork with upstream | sim-upstream-sync |
| Create custom skills | skill-creator |

---

<common_patterns>

## Common Code Patterns

### Provider execution with BYOK + structured output
```typescript
const provider = await getProviderExecutor(providerId as ProviderId)
if (!provider) {
  throw new Error(`Provider not found: ${providerId}`)
}

let resolvedRequest = sanitizeRequest(request)
let isBYOK = false

if (request.workspaceId) {
  try {
    const result = await getApiKeyWithBYOK(
      providerId,
      request.model,
      request.workspaceId,
      request.apiKey
    )
    resolvedRequest = { ...resolvedRequest, apiKey: result.apiKey }
    isBYOK = result.isBYOK
  } catch (error) {
    logger.error('Failed to resolve API key:', {
      provider: providerId,
      model: request.model,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

resolvedRequest.isBYOK = isBYOK
const sanitizedRequest = resolvedRequest

if (sanitizedRequest.responseFormat) {
  if (
    typeof sanitizedRequest.responseFormat === 'string' &&
    sanitizedRequest.responseFormat === ''
  ) {
    logger.info('Empty response format provided, ignoring it')
    sanitizedRequest.responseFormat = undefined
  } else {
    const structuredOutputInstructions = generateStructuredOutputInstructions(
      sanitizedRequest.responseFormat
    )

    if (structuredOutputInstructions.trim()) {
      const originalPrompt = sanitizedRequest.systemPrompt || ''
      sanitizedRequest.systemPrompt =
        `${originalPrompt}\n\n${structuredOutputInstructions}`.trim()

      logger.info('Added structured output instructions to system prompt')
    }
  }
}

const response = await provider.executeRequest(sanitizedRequest)

if (isStreamingExecution(response)) {
  logger.info('Provider returned StreamingExecution')
  return response
}
```

### Optimistic React Query mutations
```typescript
return {
  onMutate: async (variables: TVariables): Promise<OptimisticMutationContext<TItem>> => {
    const queryKey = getQueryKey(variables)
    await queryClient.cancelQueries({ queryKey })
    const previousState = getSnapshot()
    const tempId = generateTempId()
    const optimisticItem = createOptimisticItem(variables, tempId)
    applyOptimisticUpdate(tempId, optimisticItem)
    logger.info(`[${name}] Added optimistic entry: ${tempId}`)
    return { tempId, previousState }
  },

  onSuccess: (data: TData, variables: TVariables, context: OptimisticMutationContext<TItem>) => {
    logger.info(`[${name}] Success, replacing temp entry ${context.tempId}`)
    replaceOptimisticEntry(context.tempId, data)
    onSuccessExtra?.(data, variables)
  },

  onError: (
    error: Error,
    _variables: TVariables,
    context: OptimisticMutationContext<TItem> | undefined
  ) => {
    logger.error(`[${name}] Failed:`, error)
    if (context?.previousState) {
      rollback(context.previousState)
      logger.info(`[${name}] Rolled back to previous state`)
    }
  },

  onSettled: (_data: TData | undefined, _error: Error | null, variables: TVariables) => {
    queryClient.invalidateQueries({ queryKey: getQueryKey(variables) })
  },
}
```

### Block registry lookup and version resolution
```typescript
export const getBlock = (type: string): BlockConfig | undefined => {
  if (registry[type]) {
    return registry[type]
  }
  const normalized = type.replace(/-/g, '_')
  return registry[normalized]
}

export const getLatestBlock = (baseType: string): BlockConfig | undefined => {
  const normalized = baseType.replace(/-/g, '_')

  const versionedKeys = Object.keys(registry).filter((key) => {
    const match = key.match(new RegExp(`^${normalized}_v(\\d+)$`))
    return match !== null
  })

  if (versionedKeys.length > 0) {
    const sorted = versionedKeys.sort((a, b) => {
      const versionA = Number.parseInt(a.match(/_v(\d+)$/)?.[1] || '0', 10)
      const versionB = Number.parseInt(b.match(/_v(\d+)$/)?.[1] || '0', 10)
      return versionB - versionA
    })
    return registry[sorted[0]]
  }

  return registry[normalized]
}
```

### API route request instrumentation
```typescript
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()

  try {
    logger.info(`[${requestId}] Provider API request started`, {
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent'),
      contentType: request.headers.get('Content-Type'),
    })

    const body = await request.json()
    const {
      provider,
      model,
      systemPrompt,
      context,
      tools,
      temperature,
      maxTokens,
      apiKey,
      azureEndpoint,
      azureApiVersion,
      vertexProject,
      vertexLocation,
      vertexCredential,
      bedrockAccessKeyId,
      bedrockSecretKey,
      bedrockRegion,
      responseFormat,
      workflowId,
      workspaceId,
      stream,
      messages,
      environmentVariables,
      workflowVariables,
      blockData,
      blockNameMapping,
      reasoningEffort,
      verbosity,
    } = body
```

</common_patterns>

---

<troubleshooting>

## Troubleshooting Guide

### Memory API Errors

#### "Memory key is required"

**Causes:**
1. **Missing `key` field** - The request body doesn't include the required `key` property
2. **Type mismatch** - The `key` field has the wrong type (e.g., sending a number when string is expected)
3. **Wrong API contract** - Sending memory data in incorrect format

**Correct Request Format:**
```json
{
  "key": "conversation-id-123",
  "data": [
    {
      "role": "user",
      "content": "Hello",
      "operation": "add"
    }
  ],
  "workspaceId": "workspace-id"
}
```

**Common Mistakes:**
```json
// ❌ Missing 'key' - causes "Memory key is required"
{
  "id": "890890689",
  "role": "user",
  "content": "Hello",
  "operation": "add"
}

// ❌ Type mismatch - number instead of string for 'key'
{
  "key": 890890689,
  "data": [...]
}

// ❌ Missing 'workspaceId'
{
  "key": "conversation-id",
  "data": [...]
}
```

**Solution:**
- Ensure `key` is a **string** (even if it's a numeric ID, pass as string)
- Include all required fields: `key`, `data`, `workspaceId`
- `data` must be an array or object with `role` and `content` properties
- Valid roles: `"user"`, `"assistant"`, `"system"`

#### Memory Block Configuration

When using Memory block in workflows:
```javascript
{
  type: "memory",
  name: "Store Conversation",
  position: { x: 400, y: 200 },
  data: {
    id: "<webhook1.conversation_id>",      // Memory key (required, string)
    role: "user",                           // Message role (required)
    content: "<webhook1.content>",          // Message content (required)
    operation: "add"                        // Operation: add, retrieve, delete
  }
}
```

</troubleshooting>

---

<project_notes>

## Project-Specific Notes

- CLAUDE.md exists with detailed guidelines - reference it
- Integration checklist: Tools → Block → Icon → (optional) Trigger
- SubBlock conditions/dependencies for dynamic form fields
- OAuth patterns for third-party integrations
- Vector embeddings require pgvector extension
- Socket server runs on port 3002 by default

</project_notes>

---

<specialized_agents>

## Specialized Agents & Skills

### Sub-agents

- **Planner**: Use for architecture decisions, feature planning, refactoring strategies
- **Implementer**: Use for coding features, bug fixes, optimizations, creating/modifying workflows via sim-mcp
- **Reviewer**: Use for code review, finding bugs, quality checks
- **Explore**: Use for codebase questions, finding files, understanding patterns

### Claude Skills (.claude/skills/)

- **deployment-guide**: Dockerfiles, Docker Compose, Kubernetes/Helm, Render.com Blueprints, CI/CD pipelines
- **skill-creator**: Create and package custom AI skills for domain-specific workflows

</specialized_agents>
