# Block Types Reference

Comprehensive list of block types available in Sim workflows.

## Trigger Blocks

### start_trigger
**Recommended** unified workflow entry point for API, manual, and chat runs. Replaces legacy `api_trigger`, `chat_trigger`, and `manual_trigger` blocks.

**Data structure:**
```typescript
{
  inputFormat?: Array<{       // Custom input fields beyond built-in ones
    name: string
    type: "string" | "number" | "boolean" | "object" | "array"
  }>
}
```

**Output:** `.input` (full input object), `.conversationId`, `.files`, plus spread fields from custom `inputFormat`

**Trigger modes:** `api`, `manual`, `chat` (all supported by this single block)

### generic_webhook
Receive webhooks from any external service. Exposes a unique webhook URL.

**Data structure:**
```typescript
{}  // Dynamic — fields come from the incoming webhook payload
```

**Output:** Fields from webhook payload, accessible via dot notation (e.g., `<Webhook.message>`)

### schedule
Trigger workflow execution on a schedule.

**Data structure:**
```typescript
{
  scheduleType: "minutes" | "hourly" | "daily" | "weekly" | "monthly" | "custom"
  cronExpression?: string     // For custom schedule type
  timezone?: string           // IANA timezone (e.g., "America/New_York")
}
```

> **⚠️ Legacy triggers (`api_trigger`, `chat_trigger`, `manual_trigger`, `input_trigger`, `starter`) are hidden and deprecated. Always use `start_trigger` instead.**

## Agent Blocks

### agent
AI agent with LLM capabilities, tool access, and knowledge base integration.

**Data structure:**
```typescript
{
  model: string              // e.g., "gpt-4", "claude-3-opus"
  messages: Array<{          // Conversation messages (includes system prompt)
    role: "system" | "user" | "assistant"
    content: string
  }>
  temperature?: number       // 0-1, controls randomness
  maxTokens?: number        // Maximum response length
  tools?: string[]          // Tool IDs to enable
  knowledgeBase?: string    // Knowledge base ID
  skills?: Array<{ skillId: string, name?: string }>  // Agent skills (progressive disclosure)
}
```

**⚠️ No `systemPrompt` subblock** — use the `messages` array with `{ "role": "system", "content": "..." }` instead.

**Output:** Agent response text and tool calls

#### Skills

Agent blocks support **progressive disclosure skills** — reusable instruction sets that are loaded on-demand when the LLM requests them via the `load_skill` tool.

Skills are stored at the workspace level and attached to agent blocks via the `skills` sub-block. At execution time:
1. Available skills are listed in the system prompt
2. The LLM receives a `load_skill` tool
3. When called, the full skill content is provided to the LLM

**Format:** Array of `{ skillId: string, name?: string }`
- `skillId` references a skill in the workspace (UUID)
- `name` is optional (used as fallback display name if skill is deleted)

## Logic Blocks

### condition
Branching logic based on JavaScript expression evaluation.

**Data structure:**
```typescript
{
  conditions: Array<{
    id: string                // Unique condition ID (used in edge sourceHandle)
    title: string             // "if", "else if", or "else"
    value: string             // JavaScript expression using `context` object
  }>
}
```

**Condition expression syntax:**
The `context` object is auto-populated from the source block's output (spread flat). You can also use `<BlockName.field>` tag syntax.

```typescript
// Examples by source block type:
"context.result.priority === 'high'"          // source = function block
"context.content.includes('urgent')"          // source = agent block
"context.status === 200"                       // source = api block
"context.data.items.length > 0"               // source = api block
"context.input.mode === 'strict'"             // source = start_trigger

// Using tag syntax (any upstream block):
"<Function 1.result.score> >= 80"

// Multi-condition chain:
// condition 1 (if):     "context.status === 200 && context.data.valid === true"
// condition 2 (else if): "context.status === 200"
// condition 3 (else):    ""   ← empty = catch-all fallback
```

**Output fields:**
- `conditionResult` (boolean) — whether a condition matched
- `selectedPath` (object | null) — `{ blockId, blockType, blockTitle }` of matched path
- `selectedOption` (string | null) — matched condition's ID
- Also spreads source block output into its own output

**Handles:**
- `condition-{conditionId}` — routes to the target for each matching condition

### Condition Branching Deep Dive

**Multi-condition chains (if / else-if / else):**
```json
[
  { "id": "high", "title": "if", "value": "context.result.priority === 'high'" },
  { "id": "medium", "title": "else if", "value": "context.result.priority === 'medium'" },
  { "id": "fallback", "title": "else", "value": "" }
]
```
Each condition is evaluated in order. The first truthy match wins. An empty `value` (`""`) acts as a catch-all fallback (always matches if no prior condition matched).

**Edge wiring for multi-conditions:**
```
edge: source="cond", target="high_agent",   sourceHandle="condition-high"
edge: source="cond", target="medium_agent",  sourceHandle="condition-medium"
edge: source="cond", target="default_agent", sourceHandle="condition-fallback"
```

**Complex expressions:**
```javascript
// Boolean logic (&&, ||)
"context.status === 200 && context.data.items.length > 0"
"context.result.type === 'A' || context.result.type === 'B'"

// Nested property checks
"context.data.user.role === 'admin'"
"context.result.scores[0] >= 80"

// Null-safe checks
"context.data && context.data.results && context.data.results.length > 0"

// String methods
"context.content.toLowerCase().includes('error')"
"context.data.email.endsWith('@company.com')"

// Numeric comparisons
"context.result.confidence >= 0.95"
"context.data.items.length > 0 && context.data.items.length <= 100"

// Type checks
"typeof context.result === 'object'"
"Array.isArray(context.data.items)"
```

### router
Multi-way routing based on multiple conditions.

**Data structure:**
```typescript
{
  routes: Array<{
    condition: string        // JavaScript expression
    handle: string          // Output handle name
  }>
  defaultHandle?: string    // Fallback handle if no conditions match
}
```

**Handles:** Dynamic based on routes configuration

## Loop Blocks

### loop
Iterate over arrays or repeat until condition met.

**Data structure:**
```typescript
{
  type: "forEach" | "while"
  array?: string             // For forEach: array expression
  condition?: string         // For while: continuation condition
  maxIterations?: number    // Safety limit
}
```

**Output:** Array of iteration results

### parallel
Execute multiple paths simultaneously and aggregate results.

**Data structure:**
```typescript
{
  waitForAll?: boolean      // Wait for all branches or first completion
  timeout?: number          // Milliseconds
}
```

**Output:** Array of parallel execution results

## Integration Blocks

### api
Make HTTP requests to external APIs.

**Data structure:**
```typescript
{
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  url: string
  headers?: Record<string, string>
  body?: any
  timeout?: number
}
```

**Output:** Response data (status, headers, body)

### webhook
Send data to external webhook URLs.

**Data structure:**
```typescript
{
  url: string
  method?: "POST" | "PUT"
  headers?: Record<string, string>
  body?: any
}
```

**Output:** Response status and data

## Data Blocks

### response
Return data from workflow execution. Typically last block in workflow.

**Data structure:**
```typescript
{
  data: any                 // Data to return, supports expressions
  statusCode?: number       // HTTP status code (default 200)
}
```

**Output:** Formatted response

### code
Execute custom JavaScript/TypeScript code.

**Data structure:**
```typescript
{
  code: string              // JavaScript code to execute
  timeout?: number          // Execution timeout in ms
}
```

**Input:** `params` is always `{}` for regular function blocks (only populated for custom tool executions). Previous block outputs accessed via tag syntax `<BlockName.field>` (replaced with variable references before execution; block names in function code must not contain spaces).
**Output:** Return value wrapped as `{ result: <returnValue>, stdout: "" }`

## Transform Blocks

### json_transform
Transform JSON data using JSONata expressions.

**Data structure:**
```typescript
{
  expression: string        // JSONata expression
}
```

**Output:** Transformed data

### map
Apply transformation to each item in an array.

**Data structure:**
```typescript
{
  array: string             // Array expression
  transform: string         // Transformation expression per item
}
```

**Output:** Transformed array

## Storage Blocks

### knowledge_base
Query vector database for semantic search.

**Data structure:**
```typescript
{
  knowledgeBaseId: string
  query: string             // Search query
  limit?: number           // Max results
  minScore?: number        // Minimum similarity score
}
```

**Output:** Array of relevant documents

### variable_set
Set workflow variable value.

**Data structure:**
```typescript
{
  variableId: string
  value: any               // Value to set, supports expressions
}
```

### variable_get
Get workflow variable value.

**Data structure:**
```typescript
{
  variableId: string
}
```

**Output:** Variable value

## Utility Blocks

### delay
Pause workflow execution for specified duration.

**Data structure:**
```typescript
{
  duration: number          // Milliseconds
}
```

### log
Log data for debugging and monitoring.

**Data structure:**
```typescript
{
  message: string           // Log message, supports expressions
  level?: "info" | "warn" | "error"
}
```

## Human-in-the-Loop Blocks

### hitl
Pause workflow and wait for human approval or input.

**Data structure:**
```typescript
{
  message: string           // Message to display
  options?: string[]        // Available choices
  timeout?: number          // Auto-resume timeout
}
```

**Output:** User response or timeout indication

## Block Configuration Best Practices

### Using Expressions
Blocks support tag expressions to reference workflow data:
- `<BlockName.field>` - Output from a specific block (uses display name)
- `<variable.name>` - Workflow variable reference
- In **condition blocks**, use `context.field` for source block output (auto-populated)
- In **function blocks**, tags become safe variable references (not inline strings)
- **Do NOT use** `{{blocks.blockId.output}}` or `{{input}}` — these are not valid syntax

### Position Layout
Standard spacing for visual clarity:
- Start blocks: x=100-200
- Middle blocks: x=300-700
- End blocks: x=800+
- Vertical spacing: 100-150px between parallel paths

### Error Handling
Enable error handlers on critical blocks:
```typescript
{
  onError: {
    continueOnError: boolean
    fallbackValue?: any
    errorHandler?: string   // Block ID to handle errors
  }
}
```

### Timeouts
Set reasonable timeouts to prevent stuck workflows:
- API calls: 30-60 seconds
- Agent blocks: 60-120 seconds
- Code blocks: 10-30 seconds
- Loop blocks: Set maxIterations

## Block Validation

When adding blocks, the system validates:
1. Required fields present (type, name, position)
2. Block type exists and is supported
3. Data structure matches block type schema
4. Position values are numbers
5. IDs are unique within workflow

Invalid blocks will be rejected with error details.
