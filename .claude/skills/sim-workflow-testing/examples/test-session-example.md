# Test Session Example: Voice/Image Handoff Verification

A complete walkthrough of testing the Kamatas PROD voice and image message
handoff feature. This example covers two scenarios end-to-end, from payload
creation through verification and result recording.

---

## Context

**What we're testing:** The voice/image handoff feature routes media messages
(voice notes, photos, videos) to a human agent via Chatwoot instead of processing
them through the AI agent. This prevents silent message drops.

**Why:** Before this feature, voice and image messages from WhatsApp customers
were silently dropped — the workflow only handled text. Now, media messages
trigger an automated handoff with a Turkish acknowledgment to the customer.

**Scenarios selected:**
1. **CR-04** (CONDITION_ONLY) — Voice message routes to media path
2. **MH-01** (PATH_ISOLATION) — Voice message media handoff executes correctly

---

## Step 1: Identify Scenarios to Test

We want to verify the voice handoff works correctly. This requires two levels:

1. **Routing correctness** — Does a voice message take the media path? (CONDITION_ONLY)
2. **Handoff behavior** — Does the Media Handoff function produce correct output? (PATH_ISOLATION)

From `references/company-tests/kamatas-test-suite.md`:

```
CR-04: Voice Message → Media Path
  Profile: CONDITION_ONLY
  Input: message_type: "incoming", content: "", attachments: [audio]
  Expected: Incoming Only → ELSE → Is Media Message? → IF

MH-01: Voice Message Handoff
  Profile: PATH_ISOLATION (media)
  Input: Same as CR-04
  Expected: Media Handoff function executes and produces acknowledgment
```

---

## Step 2: Prepare the Environment

### 2.1 Create SQL Tracking Tables

```sql
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    profile TEXT NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id),
    scenario_id TEXT NOT NULL,
    scenario_name TEXT NOT NULL,
    test_group TEXT NOT NULL,
    profile TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    execution_id TEXT,
    expected_path TEXT,
    actual_path TEXT,
    expected_output TEXT,
    actual_output TEXT,
    error_message TEXT,
    executed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS block_snapshots (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id),
    block_id TEXT NOT NULL,
    block_name TEXT NOT NULL,
    original_enabled INTEGER NOT NULL,
    test_enabled INTEGER,
    restored INTEGER DEFAULT 0
);
```

### 2.2 Snapshot the Workflow

Fetch current block states:

```
get_workflow(
    workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56",
    verbose=false
)
```

**Expected response (blocks array):**
```json
{
    "blocks": [
        {"id": "f3d0bdbd-2304-40ee-84ef-210613d7828a", "name": "Webhook 1", "enabled": true},
        {"id": "dcad3f5b-de7c-4f67-b144-aea1bd924ea9", "name": "Incoming Only", "enabled": true},
        {"id": "block-9f9c16f6-da15-4e56-a08a-2a036e48832a", "name": "Is Media Message?", "enabled": true},
        {"id": "block-b0a9fec7-4938-4c4c-bf17-87c193b468b1", "name": "Media Handoff", "enabled": true},
        {"id": "5c001454-9711-456e-b56c-c66baccb1d3c", "name": "fetchCustomerInformation", "enabled": true},
        {"id": "d4b467d3-b1d6-4319-a7d8-356f1bbda3ed", "name": "storeUserMessage", "enabled": true}
        // ... 16 more blocks, all enabled: true
    ]
}
```

Record snapshot:

```sql
INSERT INTO test_runs (id, workflow_id, workflow_name, profile)
VALUES ('run-voice-001', '98c363ef-febc-42cc-82d2-d40b501c5b56', 'Kamatas PROD', 'CONDITION_ONLY');

-- Snapshot all 22 blocks (showing first few)
INSERT INTO block_snapshots (id, run_id, block_id, block_name, original_enabled) VALUES
('snap-001', 'run-voice-001', 'f3d0bdbd-2304-40ee-84ef-210613d7828a', 'Webhook 1', 1),
('snap-002', 'run-voice-001', 'dcad3f5b-de7c-4f67-b144-aea1bd924ea9', 'Incoming Only', 1),
('snap-003', 'run-voice-001', 'block-9f9c16f6-da15-4e56-a08a-2a036e48832a', 'Is Media Message?', 1),
('snap-004', 'run-voice-001', 'block-b0a9fec7-4938-4c4c-bf17-87c193b468b1', 'Media Handoff', 1),
('snap-005', 'run-voice-001', '5c001454-9711-456e-b56c-c66baccb1d3c', 'fetchCustomerInformation', 1),
('snap-006', 'run-voice-001', 'd4b467d3-b1d6-4319-a7d8-356f1bbda3ed', 'storeUserMessage', 1);
-- ... (continue for all 22 blocks)
```

---

## Step 3: Run CONDITION_ONLY Profile (CR-04)

### 3.1 Disable Non-Condition Blocks

For CONDITION_ONLY, we keep only: Webhook 1, Incoming Only, Is Media Message?.
Disable all 19 other blocks:

```
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="block-b0a9fec7-4938-4c4c-bf17-87c193b468b1", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="buildconversationcompositekey", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="5c001454-9711-456e-b56c-c66baccb1d3c", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="d4b467d3-b1d6-4319-a7d8-356f1bbda3ed", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="ca5acc54-e9d3-45a3-965e-ef10c3b8295d", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="bc6cc87d-ff39-46f8-aa9f-75c2c8211e58", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="c18d418f-5b3e-4175-a960-08c9c92bf93a", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="a057131e-a319-4515-b985-f2311c7f7e08", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="f2c10d85-997c-48d6-a102-a0197362ac36", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="35a00fab-a271-4aa6-9ab9-87e69cd8ee59", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="2c432318-c33e-411e-b6fa-700650d85c86", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="598e048a-3ab1-4024-b4b1-355e9a2df137", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="cfeba002-3f61-4c8e-b05e-aabfc8deeb60", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="892e0602-dfb4-4a92-aa61-2b7d0ca6fce7", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="89d6feb8-481c-45c5-a91f-962eae28c8e1", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="77f980fc-5cd0-440d-ac59-72f170efa36f", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="84cc0a48-f4f2-407d-a5bf-bc9011de7ba2", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="e38be766-a89b-4375-9f16-d729bcd5201d", enabled=false)
toggle_block_enabled(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", blockId="3275b7a8-ac67-411a-bfe7-f139c90d877e", enabled=false)
```

### 3.2 Execute with Voice Message Payload

```
execute_workflow(
    workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56",
    triggerType="webhook",
    useDraftState=true,
    input={
        "event": "message_created",
        "id": 99004,
        "content": "",
        "content_type": "text",
        "message_type": "incoming",
        "created_at": "2026-02-11T10:01:00.000Z",
        "private": false,
        "source_id": null,
        "content_attributes": {},
        "sender": {
            "id": 12345,
            "name": "Test Müşteri",
            "phone_number": "+905551234567",
            "email": null,
            "type": "contact"
        },
        "conversation": {
            "additional_attributes": {},
            "can_reply": true,
            "channel": "Channel::Api",
            "contact_inbox": {"id": 100, "source_id": "wa:905551234567"},
            "id": 42,
            "inbox_id": 1,
            "messages": [],
            "meta": {
                "sender": {
                    "id": 12345,
                    "name": "Test Müşteri",
                    "phone_number": "+905551234567",
                    "type": "contact"
                }
            },
            "status": "pending",
            "unread_count": 1
        },
        "account": {"id": 1, "name": "Kamatas"},
        "attachments": [
            {
                "id": 501,
                "message_id": 99004,
                "file_type": "audio",
                "account_id": 1,
                "data_url": "https://chatwoot-assets.example.com/voice_message_001.ogg",
                "extension": "ogg",
                "thumb_url": null
            }
        ]
    }
)
```

**Expected response:**
```json
{
    "success": true,
    "executionId": "exec-abc123",
    "output": {},
    "metadata": {
        "duration": 150,
        "startTime": "2026-02-11T10:01:00.100Z",
        "endTime": "2026-02-11T10:01:00.250Z"
    }
}
```

### 3.3 Check Execution Logs

Extract the `executionId` from the `execute_workflow` response (e.g., `"exec-abc123"` from Step 3.2),
then fetch logs for that specific execution:

```
get_execution_logs(
    workspaceId="ac7ec7a6-f09a-4035-8e96-e9e95b75221b",
    executionId="exec-abc123",
    details="full",
    includeTraceSpans=true,
    includeFinalOutput=true
)
```

**Expected trace spans:**
```json
{
    "logs": [
        {
            "id": "log-xyz789",
            "level": "info",
            "executionId": "exec-abc123",
            "duration": 150,
            "traceSpans": [
                {
                    "blockId": "f3d0bdbd-2304-40ee-84ef-210613d7828a",
                    "blockName": "Webhook 1",
                    "blockType": "generic_webhook",
                    "status": "success",
                    "startTime": "2026-02-11T10:01:00.100Z",
                    "endTime": "2026-02-11T10:01:00.120Z"
                },
                {
                    "blockId": "dcad3f5b-de7c-4f67-b144-aea1bd924ea9",
                    "blockName": "Incoming Only",
                    "blockType": "condition",
                    "status": "success",
                    "startTime": "2026-02-11T10:01:00.125Z",
                    "endTime": "2026-02-11T10:01:00.135Z",
                    "output": {
                        "conditionResult": false,
                        "selectedOption": "condition-9dd96cb8-c79f-4ebb-82b0-f767ec7365f0-else"
                    }
                },
                {
                    "blockId": "block-9f9c16f6-da15-4e56-a08a-2a036e48832a",
                    "blockName": "Is Media Message?",
                    "blockType": "condition",
                    "status": "success",
                    "startTime": "2026-02-11T10:01:00.140Z",
                    "endTime": "2026-02-11T10:01:00.150Z",
                    "output": {
                        "conditionResult": true,
                        "selectedOption": "condition-block-9f9c16f6-da15-4e56-a08a-2a036e48832a-if"
                    }
                }
            ]
        }
    ]
}
```

### 3.4 Verify Assertions

```
✅ ASSERT: trace_block_names EQUALS ["Webhook 1", "Incoming Only", "Is Media Message?"]
   Actual: ["Webhook 1", "Incoming Only", "Is Media Message?"] — MATCH

✅ ASSERT: block("Incoming Only").conditionResult EQUALS false
   Actual: false — MATCH (voice message correctly routes to ELSE)

✅ ASSERT: block("Is Media Message?").conditionResult EQUALS true
   Actual: true — MATCH (audio attachment correctly detected as media)

✅ ASSERT: trace_block_names NOT_CONTAINS ["Media Handoff"]
   Actual: Not present — MATCH (Media Handoff is disabled in CONDITION_ONLY)

✅ ASSERT: trace_block_names NOT_CONTAINS ["fetchCustomerInformation"]
   Actual: Not present — MATCH (text path blocks are disabled)
```

**Result: CR-04 PASSED ✅**

Record in SQL:

```sql
INSERT INTO test_results (id, run_id, scenario_id, scenario_name, test_group, profile, status, expected_path, actual_path)
VALUES ('res-cr04', 'run-voice-001', 'CR-04', 'Voice Message → Media Path', 'condition_routing', 'CONDITION_ONLY', 'passed',
        '["Webhook 1", "Incoming Only", "Is Media Message?"]',
        '["Webhook 1", "Incoming Only", "Is Media Message?"]');
```

---

## Step 4: Run PATH_ISOLATION for Media Path (MH-01)

### 4.1 Restore All Blocks First

Since we're switching profiles, restore all blocks:

```
-- Re-enable all 19 disabled blocks (showing key ones)
toggle_block_enabled(workflowId="98c363ef-...", blockId="block-b0a9fec7-...", enabled=true)
toggle_block_enabled(workflowId="98c363ef-...", blockId="5c001454-...", enabled=true)
// ... (re-enable all 19)
```

### 4.2 Create New Test Run

```sql
INSERT INTO test_runs (id, workflow_id, workflow_name, profile)
VALUES ('run-voice-002', '98c363ef-febc-42cc-82d2-d40b501c5b56', 'Kamatas PROD', 'PATH_ISOLATION');
```

### 4.3 Disable Text Path Blocks

For PATH_ISOLATION (media), disable 18 blocks (all text path blocks):

```
toggle_block_enabled(workflowId="98c363ef-...", blockId="5c001454-...", enabled=false)   # fetchCustomerInfo
toggle_block_enabled(workflowId="98c363ef-...", blockId="d4b467d3-...", enabled=false)   # storeUserMessage
toggle_block_enabled(workflowId="98c363ef-...", blockId="ca5acc54-...", enabled=false)   # API 1
// ... (disable all 18 text path blocks — see kamatas-test-suite.md for full list)
```

### 4.4 Execute with Same Voice Payload

```
execute_workflow(
    workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56",
    triggerType="webhook",
    useDraftState=true,
    input={ /* Same voice message payload as Step 3.2 */ }
)
```

### 4.5 Check Trace Spans

```
get_execution_logs(
    workspaceId="ac7ec7a6-f09a-4035-8e96-e9e95b75221b",
    workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56",
    details="full",
    includeTraceSpans=true,
    includeFinalOutput=true,
    limit=1
)
```

**Expected trace spans (PATH_ISOLATION includes Media Handoff):**
```json
{
    "traceSpans": [
        {
            "blockName": "Webhook 1",
            "status": "success"
        },
        {
            "blockName": "Incoming Only",
            "status": "success",
            "output": {"conditionResult": false}
        },
        {
            "blockName": "Is Media Message?",
            "status": "success",
            "output": {"conditionResult": true}
        },
        {
            "blockName": "Media Handoff",
            "blockType": "function",
            "status": "success",
            "output": {
                "result": {
                    "success": true,
                    "mediaType": "voice",
                    "operations": [
                        {"type": "status_toggle", "status": "completed"},
                        {"type": "label_add", "status": "completed"},
                        {"type": "internal_note", "status": "completed"},
                        {"type": "customer_message", "status": "completed"}
                    ],
                    "errors": [],
                    "timestamp": "2026-02-11T10:01:00.500Z"
                },
                "stdout": "Processing voice message handoff for conversation 42"
            }
        }
    ]
}
```

### 4.6 Verify Assertions

```
✅ ASSERT: trace_block_names EQUALS ["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]
   Actual: ["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"] — MATCH

✅ ASSERT: block("Media Handoff").status EQUALS "success"
   Actual: "success" — MATCH

✅ ASSERT: block("Media Handoff").output.result.mediaType EQUALS "voice"
   Actual: "voice" — MATCH

✅ ASSERT: block("Media Handoff").output.result.success EQUALS true
   Actual: true — MATCH

✅ ASSERT: block("Media Handoff").output.result.operations LENGTH 4
   Actual: 4 operations — MATCH

✅ ASSERT: trace_block_names NOT_CONTAINS ["Support Agent"]
   Actual: Not present — MATCH (text path disabled)

✅ ASSERT: trace_block_names NOT_CONTAINS ["Send to Chatwoot (No Files) 1"]
   Actual: Not present — MATCH (send disabled)
```

**Result: MH-01 PASSED ✅**

Record in SQL:

```sql
INSERT INTO test_results (id, run_id, scenario_id, scenario_name, test_group, profile, status,
    expected_path, actual_path, expected_output, actual_output)
VALUES ('res-mh01', 'run-voice-002', 'MH-01', 'Voice Message Handoff', 'media_handoff', 'PATH_ISOLATION', 'passed',
        '["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]',
        '["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]',
        'Media Handoff.output.result.mediaType = voice, operations.length = 4',
        '{"success":true,"mediaType":"voice","operations":[...],"errors":[],"timestamp":"..."}');
```

---

## Step 5: Restore All Blocks

**Critical step — never skip this.**

```
-- Re-enable all 18 disabled text path blocks
toggle_block_enabled(workflowId="98c363ef-...", blockId="5c001454-...", enabled=true)
toggle_block_enabled(workflowId="98c363ef-...", blockId="d4b467d3-...", enabled=true)
// ... (re-enable all 18)
```

Verify restoration:

```
get_workflow(workflowId="98c363ef-febc-42cc-82d2-d40b501c5b56", verbose=false)
→ All 22 blocks should show enabled: true
```

Update SQL:

```sql
UPDATE block_snapshots SET restored = 1 WHERE run_id IN ('run-voice-001', 'run-voice-002');

UPDATE test_runs SET completed_at = datetime('now'), status = 'passed' WHERE id = 'run-voice-001';
UPDATE test_runs SET completed_at = datetime('now'), status = 'passed' WHERE id = 'run-voice-002';
```

---

## Step 6: Review Results

### Summary Query

```sql
SELECT
    r.id as run_id,
    r.profile,
    r.status as run_status,
    t.scenario_id,
    t.scenario_name,
    t.status as test_status
FROM test_runs r
JOIN test_results t ON t.run_id = r.id
WHERE r.workflow_name = 'Kamatas PROD'
ORDER BY r.started_at, t.scenario_id;
```

**Expected output:**

| run_id | profile | run_status | scenario_id | scenario_name | test_status |
|--------|---------|------------|-------------|---------------|-------------|
| run-voice-001 | CONDITION_ONLY | passed | CR-04 | Voice Message → Media Path | passed |
| run-voice-002 | PATH_ISOLATION | passed | MH-01 | Voice Message Handoff | passed |

### Final Report

```
═══════════════════════════════════════════════════
  VOICE HANDOFF VERIFICATION — TEST REPORT
═══════════════════════════════════════════════════

  Workflow:  Kamatas PROD (98c363ef-...)
  Date:      2026-02-11T10:05:00Z
  Duration:  ~3 minutes

  RESULTS:
  ┌─────────────┬──────────┬──────────┬────────┐
  │ Profile     │ Scenario │ Status   │ Cost   │
  ├─────────────┼──────────┼──────────┼────────┤
  │ COND_ONLY   │ CR-04    │ PASSED ✅│ $0.00  │
  │ PATH_ISO    │ MH-01    │ PASSED ✅│ $0.00  │
  └─────────────┴──────────┴──────────┴────────┘

  Total: 2/2 passed (100%)
  Cost:  $0.00
  Blocks restored: ✅ All 22 blocks enabled

═══════════════════════════════════════════════════
```

---

## How to Handle Failures

### Example: What if CR-04 Failed?

Suppose the trace showed:
```json
{
    "traceSpans": [
        {"blockName": "Webhook 1", "status": "success"},
        {"blockName": "Incoming Only", "status": "success",
         "output": {"conditionResult": true}}
    ]
}
```

This means `Incoming Only` returned `true` for a voice message — it's routing to the
text path instead of the media path. Diagnosis:

1. **Check the condition logic** — Is "Incoming Only" checking for attachments, or just `message_type`?
   ```
   get_block(workflowId="98c363ef-...", blockId="dcad3f5b-...")
   ```
2. **Inspect the condition expression** — Does it check `attachments.length > 0`?
3. **Verify the payload** — Is the `attachments` array correctly populated?
4. **Fix** — Update the condition block's expression to exclude media messages

### Example: What if MH-01 Failed?

Suppose Media Handoff block had `status: "error"`:

```json
{
    "blockName": "Media Handoff",
    "status": "error",
    "output": {
        "error": "ReferenceError: RAVEN_URL is not defined"
    }
}
```

This means the function block references an environment variable that isn't set in the
test environment. Options:

1. **Set the env var** — Add `RAVEN_URL` to workspace environment
2. **Mark as known limitation** — Media Handoff can't fully execute in test (Chatwoot API call fails)
3. **Use CONDITION_ONLY only** — Verify routing without testing the function

Record accordingly:
```sql
UPDATE test_results SET status = 'error', error_message = 'RAVEN_URL not defined - env var missing in test'
WHERE id = 'res-mh01';
```

---

## Next Steps After This Session

1. **Run remaining CONDITION_ONLY scenarios** — CR-01 through CR-12 (text routing, outgoing drops, etc.)
2. **Run MH-02 through MH-05** — Image, video, text+image, multi-image handoff
3. **Run text flow tests** — TF-01 through TF-03
4. **Run full integration** — FI-01, FI-02 (expensive, do last)

See `references/company-tests/kamatas-test-suite.md` for the complete test matrix and
`references/testing-protocol.md` for the step-by-step protocol.
