# Verification Rules

Assertion types, expected outputs, and failure detection methods for verifying
Sim workflow test executions.

---

## Table of Contents

1. [Assertion Types](#assertion-types)
2. [Expected Blocks per Scenario](#expected-blocks-per-scenario)
3. [Output Pattern Matching](#output-pattern-matching)
4. [Failure Detection](#failure-detection)
5. [Success Criteria by Profile](#success-criteria-by-profile)

---

## Assertion Types

Four types of assertions can be made against execution results:

### 1. Path Assertion

Verifies which blocks executed during the workflow run.

**Format:**
```
ASSERT: trace_block_names EQUALS ["Block A", "Block B", "Block C"]
ASSERT: trace_block_names CONTAINS ["Block B"]
ASSERT: trace_block_names NOT_CONTAINS ["Block X"]
ASSERT: trace_block_count EQUALS 3
```

**How to extract:**
```python
# From get_execution_logs response (details="full", includeTraceSpans=true)
trace_block_names = [span["blockName"] for span in log["traceSpans"]]
```

**Examples:**
```
# Text message should hit text path blocks
ASSERT: trace_block_names CONTAINS ["Webhook 1", "Incoming Only"]
ASSERT: trace_block_names NOT_CONTAINS ["Media Handoff"]

# Voice message should hit media path blocks
ASSERT: trace_block_names CONTAINS ["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]
ASSERT: trace_block_names NOT_CONTAINS ["storeUserMessage"]
```

### 2. Condition Result Assertion

Verifies the routing decision made by a condition block.

**Format:**
```
ASSERT: block("<BLOCK_NAME>").conditionResult EQUALS true|false
ASSERT: block("<BLOCK_NAME>").selectedOption CONTAINS "if"|"else"
ASSERT: block("<BLOCK_NAME>").selectedOption EQUALS "<FULL_OPTION_ID>"
```

**How to extract:**
```python
# Find the condition block in trace spans
condition_span = next(s for s in log["traceSpans"] if s["blockName"] == "Incoming Only")
condition_result = condition_span["output"]["conditionResult"]
selected_option = condition_span["output"]["selectedOption"]
```

**Examples:**
```
# Text message: Incoming Only should select IF path
ASSERT: block("Incoming Only").conditionResult EQUALS true
ASSERT: block("Incoming Only").selectedOption CONTAINS "if"

# Voice message: Incoming Only should select ELSE path
ASSERT: block("Incoming Only").conditionResult EQUALS false
ASSERT: block("Incoming Only").selectedOption CONTAINS "else"

# Voice message: Is Media Message? should select IF path
ASSERT: block("Is Media Message?").conditionResult EQUALS true
```

**Known Condition Option IDs (Kamatas PROD):**

| Block | IF Option ID | ELSE Option ID |
|-------|-------------|----------------|
| Incoming Only | `condition-9dd96cb8-...-if` | `condition-9dd96cb8-...-else` |
| Is Media Message? | `condition-block-9f9c16f6-...-if` | implicit else (no match) |
| checkIfTheMessageLatest | `condition-6c9c86c3-...-if` | implicit else |
| checkIfTheMessageLatest2 | `condition-35e2d3f8-...-if` | implicit else |
| Has IKAS Context? | `condition-has-context-if` | `condition-has-context-else` |

### 3. Status Assertion

Verifies whether a block succeeded, failed, or was skipped.

**Format:**
```
ASSERT: block("<BLOCK_NAME>").status EQUALS "success"|"error"|"skipped"
ASSERT: execution.status EQUALS "success"|"error"
```

**How to extract:**
```python
block_span = next(s for s in log["traceSpans"] if s["blockName"] == "Media Handoff")
block_status = block_span["status"]

# Overall execution status
execution_status = log["level"]  # "info" = success, "error" = failure
```

**Examples:**
```
# All blocks in the executed path should succeed
ASSERT: block("Webhook 1").status EQUALS "success"
ASSERT: block("Incoming Only").status EQUALS "success"
ASSERT: block("Media Handoff").status EQUALS "success"

# Overall execution should succeed
ASSERT: execution.status EQUALS "success"
```

### 4. Output Assertion

Verifies the content produced by a block.

**Format:**
```
ASSERT: block("<BLOCK_NAME>").output CONTAINS "<SUBSTRING>"
ASSERT: block("<BLOCK_NAME>").output.result MATCHES "<REGEX>"
ASSERT: block("<BLOCK_NAME>").output.result.<FIELD> EQUALS "<VALUE>"
ASSERT: final_output CONTAINS "<SUBSTRING>"
```

**How to extract:**
```python
# Block output from trace span
block_span = next(s for s in log["traceSpans"] if s["blockName"] == "Media Handoff")
block_output = block_span.get("output", {})

# Final workflow output
final_output = log.get("output", {})
```

**Examples:**
```
# Media Handoff should produce structured handoff result
ASSERT: block("Media Handoff").output.result.mediaType EQUALS "voice"
    OR: block("Media Handoff").output.result.mediaType EQUALS "image"
    OR: block("Media Handoff").output.result.mediaType EQUALS "video"

# Verify handoff operation count and success
ASSERT: block("Media Handoff").output.result.operations LENGTH 4
ASSERT: block("Media Handoff").output.result.success EQUALS true
ASSERT: block("Media Handoff").output.result.errors LENGTH 0
ASSERT: block("Media Handoff").output.stdout NOT_EMPTY

# Support Agent should produce a response
ASSERT: block("Support Agent").output.content NOT_EMPTY
ASSERT: block("Support Agent").output.content LENGTH > 10
```

---

## Expected Blocks per Scenario

Quick reference for which blocks should appear in trace spans for each scenario.

### CONDITION_ONLY Profile

Only condition blocks + trigger are enabled, so traces are short:

| Scenario | Expected Trace Blocks |
|----------|-----------------------|
| S-01: Text greeting | `["Webhook 1", "Incoming Only"]` |
| S-02: Product inquiry | `["Webhook 1", "Incoming Only"]` |
| S-03: Order status | `["Webhook 1", "Incoming Only"]` |
| S-04: Voice message | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| S-05: Image message | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| S-06: Video message | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| S-07: Outgoing message | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| S-08: Activity message | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| S-09: Text with image | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| S-10: Document attachment | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| S-11: Multiple attachments | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| S-12: Empty content | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| S-13: Measurement question | `["Webhook 1", "Incoming Only"]` |

### PATH_ISOLATION — Media Path

| Scenario | Expected Trace Blocks |
|----------|-----------------------|
| S-04: Voice | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| S-05: Image | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| S-06: Video | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| S-09: Text+Image | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| S-11: Multi-image | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| S-14: Mixed Audio+Image | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |

### PATH_ISOLATION — Text Path (Agent Disabled)

| Scenario | Expected Trace Blocks |
|----------|-----------------------|
| S-01: Text greeting | `["Webhook 1", "Incoming Only", "Build Conversation Composite Key", "fetchCustomerInformation", "storeUserMessage", "API 1", "debounceWait", ...]` |

> Note: Exact trace depends on which blocks are kept enabled. With Support Agent disabled,
> execution may stop at Loop 1 entry or continue through the loop with errors.

---

## Output Pattern Matching

### Media Handoff Expected Outputs

The Media Handoff function block should produce output that includes:

| Media Type | Expected Output Pattern |
|------------|------------------------|
| Voice (audio) | `result` contains acknowledgment referencing voice/audio message |
| Image | `result` contains acknowledgment referencing photo/image |
| Video | `result` contains acknowledgment referencing video |

**Turkish language patterns to check:**
```
Voice: "sesli mesaj" (voice message)
Image: "fotoğraf" (photo) or "görsel" (image)
Video: "video"
General: "ekibimize iletildi" (forwarded to our team)
```

### Support Agent Expected Outputs

When testing with FULL_INTEGRATION profile:

| Input Type | Expected Output Pattern |
|------------|------------------------|
| Greeting ("Merhaba") | Response in Turkish, welcoming, mentions Kamatas |
| Product inquiry ("Sineklik fiyatları") | References sineklik products, may include prices |
| Order status ("Siparişim nerede?") | Asks for order number or phone, or provides status |
| Measurement question | References measurement instructions or videos |

### Condition Block Outputs

| Block | IF Condition | Expected `conditionResult` |
|-------|-------------|---------------------------|
| Incoming Only | `message_type == "incoming"` AND no media attachments | `true` for text, `false` for media/outgoing |
| Is Media Message? | Has audio/image/video attachment | `true` for media, `false` for non-media |
| checkIfTheMessageLatest | Current message is the latest in conversation | `true` if no newer messages |
| Has IKAS Context? | Agent tool calls returned ikas data | `true` if ikas context exists |

---

## Failure Detection

### Failure Types

| Failure Type | Detection Method | Common Cause |
|-------------|-----------------|--------------|
| **Wrong Path** | Path assertion fails — wrong blocks in trace | Condition logic error, wrong payload fields |
| **Missing Block** | Expected block not in trace | Block disabled when it shouldn't be, or edge broken |
| **Extra Block** | Unexpected block in trace | Block enabled when it should be disabled |
| **Wrong Condition** | Condition result assertion fails | Condition expression doesn't match expected logic |
| **Block Error** | Status assertion fails — block status is "error" | Runtime error in function/API block |
| **Empty Output** | Output assertion fails — block produced no output | Function returned nothing, API returned empty |
| **Wrong Output** | Output doesn't match expected pattern | Logic error in function block code |
| **Timeout** | Execution takes too long (>30s for simple tests) | Wait blocks, slow API calls |
| **Execution Error** | `execute_workflow` returns `success: false` | Invalid payload, missing env vars, disabled required block |

### Diagnostic Steps

When a test fails:

1. **Check the trace spans** — Which blocks actually executed?
2. **Compare expected vs actual path** — Where did routing diverge?
3. **Check condition outputs** — Was the condition result correct for the input?
4. **Check block outputs** — Did function blocks produce expected results?
5. **Check for errors** — Any block with status "error"?
6. **Verify block states** — Are the right blocks enabled/disabled?
7. **Verify payload** — Does the input match the scenario specification?

### Common Misdiagnoses

| Symptom | Looks Like | Actually Is |
|---------|-----------|-------------|
| No blocks in trace | Workflow broken | Trigger block not matching payload format |
| Only Webhook 1 in trace | Condition dropping everything | Condition evaluating payload fields incorrectly |
| Media goes to text path | Media detection broken | Payload missing `attachments` array |
| Text goes to media path | Routing wrong | Incoming Only condition modified to exclude text+attachment |

---

## Success Criteria by Profile

### CONDITION_ONLY Success

A CONDITION_ONLY test passes when:

- [ ] Correct condition path selected (IF vs ELSE) for each condition block
- [ ] No blocks beyond conditions appear in trace
- [ ] No execution errors
- [ ] Condition result values match expected values

### PATH_ISOLATION Success

A PATH_ISOLATION test passes when:

- [ ] All enabled blocks on the target path appear in trace
- [ ] No blocks from other paths appear in trace
- [ ] All block statuses are "success"
- [ ] Block outputs match expected patterns (if verifiable)
- [ ] No execution errors

### FULL_INTEGRATION Success

A FULL_INTEGRATION test passes when:

- [ ] Complete expected path appears in trace
- [ ] All block statuses are "success"
- [ ] Agent output is relevant and in correct language (Turkish for Kamatas)
- [ ] Tool calls (if any) are appropriate for the input
- [ ] Final output would be a valid customer response
- [ ] Send to Chatwoot block is disabled (no real message sent)

### Cross-Profile Validation

A scenario is fully validated when it passes all applicable profiles:

```
Scenario S-04 (Voice message):
  ✅ CONDITION_ONLY  → Routes to media path (Is Media Message? = true)
  ✅ PATH_ISOLATION  → Media Handoff executes successfully
  ✅ FULL_INTEGRATION → Complete media handling produces correct acknowledgment
```
