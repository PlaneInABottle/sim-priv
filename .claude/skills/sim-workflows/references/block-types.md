# Block Types Reference

Comprehensive list of block types available in Sim workflows.

## Trigger Blocks

### api_trigger
Starts workflow execution via API call. Provides request data as workflow input.

**Data structure:**
```typescript
{
  method?: "GET" | "POST" | "PUT" | "DELETE"
}
```

**Output:** Spread top-level fields from inputFormat, `.input` (full input object), optional `.files`

## Agent Blocks

### agent
AI agent with LLM capabilities, tool access, and knowledge base integration.

**Data structure:**
```typescript
{
  model: string              // e.g., "gpt-4", "claude-3-opus"
  systemPrompt: string       // System instructions
  temperature?: number       // 0-1, controls randomness
  maxTokens?: number        // Maximum response length
  tools?: string[]          // Tool IDs to enable
  knowledgeBase?: string    // Knowledge base ID
}
```

**Output:** Agent response text and tool calls

## Logic Blocks

### condition
Branching logic based on JavaScript expression evaluation.

**Data structure:**
```typescript
{
  condition: string          // JavaScript expression, e.g., "{{input.status}} === 'success'"
}
```

**Output fields:**
- `conditionResult` (boolean) — whether a condition matched
- `selectedPath` (object | null) — `{ blockId, blockType, blockTitle }` of matched path
- `selectedOption` (string | null) — matched condition's ID
- Also spreads source block output into its own output

**Handles:**
- `condition-{conditionId}` — routes to the target for each matching condition

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
Blocks support template expressions to reference workflow data:
- `{{input}}` - Current block input
- `{{variables.name}}` - Workflow variable
- `{{blocks.blockId.output}}` - Output from specific block
- `{{trigger.input}}` - Trigger input data

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
