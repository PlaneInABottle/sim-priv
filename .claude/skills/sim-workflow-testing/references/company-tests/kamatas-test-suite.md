# Kamatas PROD — Complete Test Suite

Test matrix for the Kamatas PROD workflow (`53408cc2-52fa-46e5-85d7-402d2f42f3a4`).

**Workspace:** `ac7ec7a6-f09a-4035-8e96-e9e95b75221b`
**Total Scenarios:** 24 (13 Condition Routing + 6 Media Handoff + 3 Text Flow + 2 Full Integration)
**Block Count:** 22

---

## Table of Contents

1. [Block Map](#block-map)
2. [Test Group 1: Condition Routing](#test-group-1-condition-routing)
3. [Test Group 2: Media Handoff Logic](#test-group-2-media-handoff-logic)
4. [Test Group 3: Text Flow](#test-group-3-text-flow)
5. [Test Group 4: Full Integration](#test-group-4-full-integration)
6. [Block Disable Profiles](#block-disable-profiles)
7. [Execution Order](#execution-order)

---

## Block Map

Complete block inventory with full UUIDs for use in sim-mcp tool calls.

| # | Block Name | Full Block ID | Type | Path |
|---|-----------|---------------|------|------|
| 1 | Webhook 1 | `f3d0bdbd-2304-40ee-84ef-210613d7828a` | generic_webhook | Entry |
| 2 | Incoming Only | `dcad3f5b-de7c-4f67-b144-aea1bd924ea9` | condition | Router |
| 3 | Is Media Message? | `block-9f9c16f6-da15-4e56-a08a-2a036e48832a` | condition | Media |
| 4 | Media Handoff | `block-b0a9fec7-4938-4c4c-bf17-87c193b468b1` | function | Media |
| 5 | Build Conversation Composite Key | `buildconversationcompositekey` | function | Text |
| 6 | fetchCustomerInformation | `5c001454-9711-456e-b56c-c66baccb1d3c` | workflow_input | Text |
| 7 | storeUserMessage | `d4b467d3-b1d6-4319-a7d8-356f1bbda3ed` | memory | Text |
| 8 | API 1 | `ca5acc54-e9d3-45a3-965e-ef10c3b8295d` | api | Text |
| 9 | debounceWait | `bc6cc87d-ff39-46f8-aa9f-75c2c8211e58` | wait | Text |
| 10 | getLatestMessageId | `c18d418f-5b3e-4175-a960-08c9c92bf93a` | api | Text |
| 11 | checkIfTheMessageLatest | `a057131e-a319-4515-b985-f2311c7f7e08` | condition | Text |
| 12 | Loop 1 | `f2c10d85-997c-48d6-a102-a0197362ac36` | loop | Text |
| 13 | Support Agent | `35a00fab-a271-4aa6-9ab9-87e69cd8ee59` | agent | Text |
| 14 | AgentVariable | `2c432318-c33e-411e-b6fa-700650d85c86` | variables | Text |
| 15 | Wait 2 | `598e048a-3ab1-4024-b4b1-355e9a2df137` | wait | Text |
| 16 | getLatestMessageId2 | `cfeba002-3f61-4c8e-b05e-aabfc8deeb60` | api | Text |
| 17 | checkIfTheMessageLatest2 | `892e0602-dfb4-4a92-aa61-2b7d0ca6fce7` | condition | Text |
| 18 | Extract Search Context | `89d6feb8-481c-45c5-a91f-962eae28c8e1` | function | Text |
| 19 | Has IKAS Context? | `77f980fc-5cd0-440d-ac59-72f170efa36f` | condition | Text |
| 20 | Store IKAS Context | `84cc0a48-f4f2-407d-a5bf-bc9011de7ba2` | memory | Text |
| 21 | Memory 1 | `e38be766-a89b-4375-9f16-d729bcd5201d` | memory | Text |
| 22 | Send to Chatwoot (No Files) 1 | `3275b7a8-ac67-411a-bfe7-f139c90d877e` | function | Text |

### Path Legend

- **Entry** — Always executes (trigger block)
- **Router** — First routing decision (incoming vs other)
- **Media** — Media message handling path
- **Text** — Text message processing path (full agent pipeline)

---

## Test Group 1: Condition Routing

**Profile:** CONDITION_ONLY
**Purpose:** Verify that the Incoming Only and Is Media Message? conditions route messages correctly.
**Cost:** $0.00 per scenario

### Scenarios

#### CR-01: Text Greeting → Text Path

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-01 |
| **Payload Ref** | S-01 |
| **Input** | `message_type: "incoming"`, `content: "Merhaba"`, `attachments: []` |
| **Expected Routing** | Incoming Only → IF (text path) |
| **Expected Trace** | `["Webhook 1", "Incoming Only"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = true` |
| **Notes** | Most common message type. Must route to text path. |

#### CR-02: Product Inquiry → Text Path

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-02 |
| **Payload Ref** | S-02 |
| **Input** | `message_type: "incoming"`, `content: "Sineklik fiyatları nedir?"`, `attachments: []` |
| **Expected Routing** | Incoming Only → IF (text path) |
| **Expected Trace** | `["Webhook 1", "Incoming Only"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = true` |
| **Notes** | Product question — still a text message, routes same as greeting. |

#### CR-03: Order Status → Text Path

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-03 |
| **Payload Ref** | S-03 |
| **Input** | `message_type: "incoming"`, `content: "Siparişim nerede?"`, `attachments: []` |
| **Expected Routing** | Incoming Only → IF (text path) |
| **Expected Trace** | `["Webhook 1", "Incoming Only"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = true` |
| **Notes** | Order inquiry — text routing, same as above. |

#### CR-04: Voice Message → Media Path

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-04 |
| **Payload Ref** | S-04 |
| **Input** | `message_type: "incoming"`, `content: ""`, `attachments: [audio]` |
| **Expected Routing** | Incoming Only → ELSE → Is Media Message? → IF (media path) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = true` |
| **Notes** | Core voice handoff test. Audio attachment triggers media path. |

#### CR-05: Image Message → Media Path

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-05 |
| **Payload Ref** | S-05 |
| **Input** | `message_type: "incoming"`, `content: ""`, `attachments: [image]` |
| **Expected Routing** | Incoming Only → ELSE → Is Media Message? → IF (media path) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = true` |
| **Notes** | Image attachment triggers media path. |

#### CR-06: Video Message → Media Path

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-06 |
| **Payload Ref** | S-06 |
| **Input** | `message_type: "incoming"`, `content: ""`, `attachments: [video]` |
| **Expected Routing** | Incoming Only → ELSE → Is Media Message? → IF (media path) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = true` |
| **Notes** | Video attachment triggers media path. |

#### CR-07: Outgoing Message → Dropped

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-07 |
| **Payload Ref** | S-07 |
| **Input** | `message_type: "outgoing"`, `content: "Merhaba, size nasıl yardımcı olabilirim?"`, `attachments: []` |
| **Expected Routing** | Incoming Only → ELSE → Is Media Message? → ELSE (dropped) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = false` |
| **Notes** | Bot responses must not trigger re-processing. Both conditions should reject. |

#### CR-08: Activity Message → Dropped

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-08 |
| **Payload Ref** | S-08 |
| **Input** | `message_type: "activity"`, `content: "Conversation resolved"`, `attachments: []` |
| **Expected Routing** | Incoming Only → ELSE → Is Media Message? → ELSE (dropped) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = false` |
| **Notes** | System activity messages (resolve, reopen) must be dropped. |

#### CR-09: Text with Image → Media Path

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-09 |
| **Payload Ref** | S-09 |
| **Input** | `message_type: "incoming"`, `content: "Bu ölçülere sineklik olur mu?"`, `attachments: [image]` |
| **Expected Routing** | Incoming Only → ELSE → Is Media Message? → IF (media path) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = true` |
| **Notes** | Even with text content, presence of media attachment routes to media path. Important edge case. |

#### CR-10: Document Attachment → Dropped (Not Media)

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-10 |
| **Payload Ref** | S-10 |
| **Input** | `message_type: "incoming"`, `content: ""`, `attachments: [document]` |
| **Expected Routing** | Incoming Only → ELSE → Is Media Message? → ELSE (dropped) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = false` |
| **Notes** | Documents/PDFs (file_type="file") are NOT treated as media. They are dropped — same behavior as pre-feature. The condition logic checks `fileType === 'audio' || fileType === 'image' || fileType === 'video'` — "file" matches none, so hasMedia=false. |

#### CR-11: Multiple Image Attachments → Media Path

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-11 |
| **Payload Ref** | S-11 |
| **Input** | `message_type: "incoming"`, `content: ""`, `attachments: [image, image]` |
| **Expected Routing** | Incoming Only → ELSE → Is Media Message? → IF (media path) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = true` |
| **Notes** | Multiple attachments should still trigger media path. Verifies no single-attachment assumption. |

#### CR-12: Empty Message (No Content, No Attachments) → Dropped

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-12 |
| **Payload Ref** | S-12 |
| **Input** | `message_type: "incoming"`, `content: ""`, `attachments: []` |
| **Expected Routing** | Incoming Only → ELSE → Is Media Message? → ELSE (dropped) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = false` |
| **Notes** | Edge case: empty message with no text/attachments. Fails hasText check (`text.length > 0` is false for empty string). Message is dropped by both conditions. |

#### CR-14: Team-Assigned Conversation → Dropped

| Field | Value |
|-------|-------|
| **Scenario ID** | CR-14 |
| **Payload Ref** | S-15 |
| **Input** | `message_type: "incoming"`, `content: "Merhaba"`, `team: {"id": 1, "name": "Support Team"}` |
| **Expected Routing** | Incoming Only → ELSE (hasTeam=true) → Is Media Message? → ELSE (dropped) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?"]` |
| **Condition Assertions** | `Incoming Only.conditionResult = false`, `Is Media Message?.conditionResult = false` |
| **Notes** | Team-assigned conversations are dropped. Only personal conversations (hasTeam=false) are processed. |

---

## Test Group 2: Media Handoff Logic

**Profile:** PATH_ISOLATION (media path)
**Purpose:** Verify the Media Handoff function block processes different media types correctly.
**Cost:** $0.00–0.01 per scenario (function block only, no AI agent)

### Block Disable List

Disable all text path blocks (keep media path enabled):

```
DISABLE:
  - Build Conversation Composite Key (buildconversationcompositekey)
  - fetchCustomerInformation    (5c001454-9711-456e-b56c-c66baccb1d3c)
  - storeUserMessage            (d4b467d3-b1d6-4319-a7d8-356f1bbda3ed)
  - API 1                       (ca5acc54-e9d3-45a3-965e-ef10c3b8295d)
  - debounceWait                (bc6cc87d-ff39-46f8-aa9f-75c2c8211e58)
  - getLatestMessageId          (c18d418f-5b3e-4175-a960-08c9c92bf93a)
  - checkIfTheMessageLatest     (a057131e-a319-4515-b985-f2311c7f7e08)
  - Loop 1                      (f2c10d85-997c-48d6-a102-a0197362ac36)
  - Support Agent               (35a00fab-a271-4aa6-9ab9-87e69cd8ee59)
  - AgentVariable               (2c432318-c33e-411e-b6fa-700650d85c86)
  - Wait 2                      (598e048a-3ab1-4024-b4b1-355e9a2df137)
  - getLatestMessageId2         (cfeba002-3f61-4c8e-b05e-aabfc8deeb60)
  - checkIfTheMessageLatest2    (892e0602-dfb4-4a92-aa61-2b7d0ca6fce7)
  - Extract Search Context      (89d6feb8-481c-45c5-a91f-962eae28c8e1)
  - Has IKAS Context?           (77f980fc-5cd0-440d-ac59-72f170efa36f)
  - Store IKAS Context          (84cc0a48-f4f2-407d-a5bf-bc9011de7ba2)
  - Memory 1                    (e38be766-a89b-4375-9f16-d729bcd5201d)
  - Send to Chatwoot (No Files) (3275b7a8-ac67-411a-bfe7-f139c90d877e)

KEEP ENABLED:
  - Webhook 1                   (f3d0bdbd-2304-40ee-84ef-210613d7828a)
  - Incoming Only               (dcad3f5b-de7c-4f67-b144-aea1bd924ea9)
  - Is Media Message?           (block-9f9c16f6-da15-4e56-a08a-2a036e48832a)
  - Media Handoff               (block-b0a9fec7-4938-4c4c-bf17-87c193b468b1)
```

### Scenarios

#### MH-01: Voice Message Handoff

| Field | Value |
|-------|-------|
| **Scenario ID** | MH-01 |
| **Payload Ref** | S-04 |
| **Input** | Voice message (audio attachment) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| **Expected Output** | `Media Handoff.output` includes `{ result, stdout }`; `result` includes `success` (boolean), `mediaType` (string), `operations` (array), `errors` (array), `timestamp` (ISO string) |
| **Status Assertions** | All blocks: `status = "success"` |
| **Output Assertions** | `Media Handoff.output.result.mediaType EQUALS "voice"`, `Media Handoff.output.result.operations LENGTH 4`, `Media Handoff.output.result.success IS BOOLEAN`, `Media Handoff.output.result.errors IS ARRAY`, `Media Handoff.output.stdout IS STRING` |

#### MH-02: Image Message Handoff

| Field | Value |
|-------|-------|
| **Scenario ID** | MH-02 |
| **Payload Ref** | S-05 |
| **Input** | Image message (image attachment) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| **Expected Output** | `Media Handoff.output` includes `{ result, stdout }`; `result` includes `success` (boolean), `mediaType` (string), `operations` (array), `errors` (array), `timestamp` (ISO string) |
| **Status Assertions** | All blocks: `status = "success"` |
| **Output Assertions** | `Media Handoff.output.result.mediaType EQUALS "image"`, `Media Handoff.output.result.operations LENGTH 4`, `Media Handoff.output.result.success IS BOOLEAN`, `Media Handoff.output.result.errors IS ARRAY`, `Media Handoff.output.stdout IS STRING` |

#### MH-03: Video Message Handoff

| Field | Value |
|-------|-------|
| **Scenario ID** | MH-03 |
| **Payload Ref** | S-06 |
| **Input** | Video message (video attachment) |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| **Expected Output** | `Media Handoff.output` includes `{ result, stdout }`; `result` includes `success` (boolean), `mediaType` (string), `operations` (array), `errors` (array), `timestamp` (ISO string) |
| **Status Assertions** | All blocks: `status = "success"` |
| **Output Assertions** | `Media Handoff.output.result.mediaType EQUALS "video"`, `Media Handoff.output.result.operations LENGTH 4`, `Media Handoff.output.result.success IS BOOLEAN`, `Media Handoff.output.result.errors IS ARRAY`, `Media Handoff.output.stdout IS STRING` |

#### MH-04: Text with Image Handoff

| Field | Value |
|-------|-------|
| **Scenario ID** | MH-04 |
| **Payload Ref** | S-09 |
| **Input** | Text + image combo: `content: "Bu ölçülere sineklik olur mu?"`, image attachment |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| **Expected Output** | Same schema as MH-02 (`{ result, stdout }` with `result.mediaType = "image"`). Text may be present in input, but media path output remains structured handoff metadata. |
| **Status Assertions** | All blocks: `status = "success"` |
| **Output Assertions** | `Media Handoff.output.result.mediaType EQUALS "image"`, `Media Handoff.output.result.operations LENGTH 4`, `Media Handoff.output.result.success IS BOOLEAN`, `Media Handoff.output.result.errors IS ARRAY`, `Media Handoff.output.stdout IS STRING` |
| **Notes** | Verifies that accompanying text doesn't break media handoff flow |

#### MH-05: Multiple Image Attachments

| Field | Value |
|-------|-------|
| **Scenario ID** | MH-05 |
| **Payload Ref** | S-11 |
| **Input** | Two image attachments, no text content |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| **Expected Output** | Media Handoff handles multiple attachments — either processes all or first |
| **Status Assertions** | All blocks: `status = "success"` |
| **Output Assertions** | `Media Handoff.output.result.mediaType EQUALS "image"`, `Media Handoff.output.result.operations LENGTH 4`, `Media Handoff.output.result.success IS BOOLEAN`, `Media Handoff.output.result.errors IS ARRAY`, `Media Handoff.output.stdout IS STRING` |
| **Notes** | Tests multi-attachment handling. Verify no array-out-of-bounds or single-item assumptions. |

#### MH-06: Mixed Audio+Image Handoff

| Field | Value |
|-------|-------|
| **Scenario ID** | MH-06 |
| **Payload Ref** | S-14 |
| **Input** | Mixed attachments: audio (.ogg) + image (.jpg), no text content |
| **Expected Trace** | `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| **Expected Output** | Media Handoff processes audio as primary media type (audio > image priority) |
| **Status Assertions** | All blocks: `status = "success"` |
| **Output Assertions** | `Media Handoff.output.result.mediaType EQUALS "voice"`, `Media Handoff.output.result.operations LENGTH 4`, `Media Handoff.output.result.success IS BOOLEAN`, `Media Handoff.output.result.errors IS ARRAY`, `Media Handoff.output.stdout IS STRING` |
| **Notes** | Tests audio > image priority. mediaType should resolve to "voice" even though image is present. Originally CR-13. |

---

## Test Group 3: Text Flow

**Profile:** PATH_ISOLATION (text path, agent disabled)
**Purpose:** Verify the text processing pipeline — from message ingestion through debounce to agent entry point.
**Cost:** $0.00 per scenario (agent disabled, no AI tokens)

### Block Disable List

Disable media path + expensive text blocks (keep pipeline blocks enabled):

```
DISABLE:
  - Is Media Message?           (block-9f9c16f6-da15-4e56-a08a-2a036e48832a)
  - Media Handoff               (block-b0a9fec7-4938-4c4c-bf17-87c193b468b1)
  - Support Agent               (35a00fab-a271-4aa6-9ab9-87e69cd8ee59)  -- saves tokens
  - Send to Chatwoot (No Files) (3275b7a8-ac67-411a-bfe7-f139c90d877e)  -- prevents real send

KEEP ENABLED:
  - Webhook 1                   (f3d0bdbd-2304-40ee-84ef-210613d7828a)
  - Incoming Only               (dcad3f5b-de7c-4f67-b144-aea1bd924ea9)
  - Build Conversation Composite Key (buildconversationcompositekey)
  - fetchCustomerInformation    (5c001454-9711-456e-b56c-c66baccb1d3c)
  - storeUserMessage            (d4b467d3-b1d6-4319-a7d8-356f1bbda3ed)
  - API 1                       (ca5acc54-e9d3-45a3-965e-ef10c3b8295d)
  - debounceWait                (bc6cc87d-ff39-46f8-aa9f-75c2c8211e58)
  - getLatestMessageId          (c18d418f-5b3e-4175-a960-08c9c92bf93a)
  - checkIfTheMessageLatest     (a057131e-a319-4515-b985-f2311c7f7e08)
  - Loop 1                      (f2c10d85-997c-48d6-a102-a0197362ac36)
  - AgentVariable               (2c432318-c33e-411e-b6fa-700650d85c86)
  - Wait 2                      (598e048a-3ab1-4024-b4b1-355e9a2df137)
  - getLatestMessageId2         (cfeba002-3f61-4c8e-b05e-aabfc8deeb60)
  - checkIfTheMessageLatest2    (892e0602-dfb4-4a92-aa61-2b7d0ca6fce7)
  - Extract Search Context      (89d6feb8-481c-45c5-a91f-962eae28c8e1)
  - Has IKAS Context?           (77f980fc-5cd0-440d-ac59-72f170efa36f)
  - Store IKAS Context          (84cc0a48-f4f2-407d-a5bf-bc9011de7ba2)
  - Memory 1                    (e38be766-a89b-4375-9f16-d729bcd5201d)
```

> **Note:** With Support Agent disabled, the Loop 1 block will attempt to start
> but the agent step inside will be skipped. The trace may show partial execution
> through the loop. This is expected behavior.

### Scenarios

#### TF-01: Simple Text Message Pipeline

| Field | Value |
|-------|-------|
| **Scenario ID** | TF-01 |
| **Payload Ref** | S-01 |
| **Input** | `content: "Merhaba"`, standard incoming text |
| **Expected Trace** | Should include: `["Webhook 1", "Incoming Only", "Build Conversation Composite Key", "fetchCustomerInformation", "storeUserMessage", "API 1", "debounceWait"]` |
| **Path Assertions** | `trace CONTAINS ["Incoming Only"]`, `Incoming Only.conditionResult = true` |
| **Status Assertions** | All executed blocks: `status = "success"` |
| **Notes** | Tests the ingestion pipeline. Execution may stop at debounceWait (wait block) or continue through to Loop 1 depending on wait configuration. |

#### TF-02: Product Inquiry Pipeline

| Field | Value |
|-------|-------|
| **Scenario ID** | TF-02 |
| **Payload Ref** | S-02 |
| **Input** | `content: "Sineklik fiyatları nedir?"`, incoming text |
| **Expected Trace** | Same as TF-01 — content doesn't affect pipeline routing |
| **Path Assertions** | Same as TF-01 |
| **Notes** | Verifies that different text content doesn't affect pipeline behavior. The content is only relevant at the Support Agent stage (which is disabled). |

#### TF-03: Measurement Question Pipeline

| Field | Value |
|-------|-------|
| **Scenario ID** | TF-03 |
| **Payload Ref** | S-13 |
| **Input** | `content: "Sineklik ölçüsünü nasıl alırım?"`, incoming text |
| **Expected Trace** | Same as TF-01 |
| **Path Assertions** | Same as TF-01 |
| **Notes** | Another text variant to confirm consistent pipeline behavior regardless of content. |

---

## Test Group 4: Full Integration

**Profile:** FULL_INTEGRATION
**Purpose:** End-to-end test with real AI agent processing. Validates complete workflow behavior.
**Cost:** $0.01–0.05 per scenario (AI agent tokens consumed)

### Block Disable List

Only disable the final send block to prevent real Chatwoot messages:

```
DISABLE:
  - Send to Chatwoot (No Files) (3275b7a8-ac67-411a-bfe7-f139c90d877e)

KEEP ENABLED:
  - All other blocks (21 blocks)
```

> **Warning:** FULL_INTEGRATION tests consume AI tokens and may make external API calls
> (ikas, Chatwoot for status toggle). Use sparingly and only after CONDITION_ONLY and
> PATH_ISOLATION tests pass.

### Scenarios

#### FI-01: Full Text Flow — Greeting

| Field | Value |
|-------|-------|
| **Scenario ID** | FI-01 |
| **Payload Ref** | S-01 |
| **Input** | `content: "Merhaba"`, standard incoming text |
| **Expected Trace** | Full text path: `["Webhook 1", "Incoming Only", "Build Conversation Composite Key", "fetchCustomerInformation", "storeUserMessage", "API 1", "debounceWait", "getLatestMessageId", "checkIfTheMessageLatest", "Loop 1", "Support Agent", "AgentVariable", "getLatestMessageId2", "checkIfTheMessageLatest2", "Extract Search Context", "Has IKAS Context?", "Memory 1"]` |
| **Output Assertions** | `Support Agent.output.content` is a Turkish greeting response, appropriate for Kamatas customer service |
| **Status Assertions** | All blocks: `status = "success"` |
| **Notes** | Most expensive test. Validates full end-to-end behavior. Agent should respond with a warm Turkish greeting mentioning Kamatas. May include: "Merhaba! Kamatas'a hoş geldiniz" or similar. **Parallel execution:** Build Conversation Composite Key fans out to fetchCustomerInformation and storeUserMessage in parallel. Trace may show them in either order: `['fetchCustomerInformation', 'storeUserMessage']` OR `['storeUserMessage', 'fetchCustomerInformation']`. Both are valid. **Conditional trace:** Trace assumes no existing IKAS context from fetchCustomerInformation. If fetchCustomerInformation returns ikas data, 'Store IKAS Context' will appear between 'Has IKAS Context?' and 'Memory 1'. |

#### FI-02: Full Media Flow — Voice Handoff

| Field | Value |
|-------|-------|
| **Scenario ID** | FI-02 |
| **Payload Ref** | S-04 |
| **Input** | Voice message (audio attachment) |
| **Expected Trace** | Full media path: `["Webhook 1", "Incoming Only", "Is Media Message?", "Media Handoff"]` |
| **Output Assertions** | `Media Handoff.output` includes `{ result, stdout }`; `result.mediaType = "voice"` and includes Chatwoot handoff operation results (`operations[]`, `success`, `errors[]`, `timestamp`) |
| **Status Assertions** | All blocks: `status = "success"` |
| **Notes** | Tests complete media handoff including Chatwoot API calls for status toggle and label assignment. May fail if Chatwoot API credentials are not configured — this is expected in test environments. |

---

## Block Disable Profiles

Summary of which blocks to disable for each test profile, using full block IDs.

### Profile: CONDITION_ONLY

Disable 19 blocks, keep 3:

```python
# Blocks to DISABLE
disable_blocks = [
    "block-b0a9fec7-4938-4c4c-bf17-87c193b468b1",  # Media Handoff
    "buildconversationcompositekey",                  # Build Conversation Composite Key
    "5c001454-9711-456e-b56c-c66baccb1d3c",          # fetchCustomerInformation
    "d4b467d3-b1d6-4319-a7d8-356f1bbda3ed",          # storeUserMessage
    "ca5acc54-e9d3-45a3-965e-ef10c3b8295d",           # API 1
    "bc6cc87d-ff39-46f8-aa9f-75c2c8211e58",           # debounceWait
    "c18d418f-5b3e-4175-a960-08c9c92bf93a",           # getLatestMessageId
    "a057131e-a319-4515-b985-f2311c7f7e08",           # checkIfTheMessageLatest
    "f2c10d85-997c-48d6-a102-a0197362ac36",           # Loop 1
    "35a00fab-a271-4aa6-9ab9-87e69cd8ee59",           # Support Agent
    "2c432318-c33e-411e-b6fa-700650d85c86",           # AgentVariable
    "598e048a-3ab1-4024-b4b1-355e9a2df137",           # Wait 2
    "cfeba002-3f61-4c8e-b05e-aabfc8deeb60",           # getLatestMessageId2
    "892e0602-dfb4-4a92-aa61-2b7d0ca6fce7",           # checkIfTheMessageLatest2
    "89d6feb8-481c-45c5-a91f-962eae28c8e1",           # Extract Search Context
    "77f980fc-5cd0-440d-ac59-72f170efa36f",           # Has IKAS Context?
    "84cc0a48-f4f2-407d-a5bf-bc9011de7ba2",           # Store IKAS Context
    "e38be766-a89b-4375-9f16-d729bcd5201d",           # Memory 1
    "3275b7a8-ac67-411a-bfe7-f139c90d877e",           # Send to Chatwoot
]

# Blocks to KEEP ENABLED
keep_blocks = [
    "f3d0bdbd-2304-40ee-84ef-210613d7828a",           # Webhook 1
    "dcad3f5b-de7c-4f67-b144-aea1bd924ea9",           # Incoming Only
    "block-9f9c16f6-da15-4e56-a08a-2a036e48832a",     # Is Media Message?
]
```

### Profile: PATH_ISOLATION — Media

Disable 18 blocks, keep 4:

```python
disable_blocks = [
    "buildconversationcompositekey",                  # Build Conversation Composite Key
    "5c001454-9711-456e-b56c-c66baccb1d3c",          # fetchCustomerInformation
    "d4b467d3-b1d6-4319-a7d8-356f1bbda3ed",          # storeUserMessage
    "ca5acc54-e9d3-45a3-965e-ef10c3b8295d",           # API 1
    "bc6cc87d-ff39-46f8-aa9f-75c2c8211e58",           # debounceWait
    "c18d418f-5b3e-4175-a960-08c9c92bf93a",           # getLatestMessageId
    "a057131e-a319-4515-b985-f2311c7f7e08",           # checkIfTheMessageLatest
    "f2c10d85-997c-48d6-a102-a0197362ac36",           # Loop 1
    "35a00fab-a271-4aa6-9ab9-87e69cd8ee59",           # Support Agent
    "2c432318-c33e-411e-b6fa-700650d85c86",           # AgentVariable
    "598e048a-3ab1-4024-b4b1-355e9a2df137",           # Wait 2
    "cfeba002-3f61-4c8e-b05e-aabfc8deeb60",           # getLatestMessageId2
    "892e0602-dfb4-4a92-aa61-2b7d0ca6fce7",           # checkIfTheMessageLatest2
    "89d6feb8-481c-45c5-a91f-962eae28c8e1",           # Extract Search Context
    "77f980fc-5cd0-440d-ac59-72f170efa36f",           # Has IKAS Context?
    "84cc0a48-f4f2-407d-a5bf-bc9011de7ba2",           # Store IKAS Context
    "e38be766-a89b-4375-9f16-d729bcd5201d",           # Memory 1
    "3275b7a8-ac67-411a-bfe7-f139c90d877e",           # Send to Chatwoot
]

keep_blocks = [
    "f3d0bdbd-2304-40ee-84ef-210613d7828a",           # Webhook 1
    "dcad3f5b-de7c-4f67-b144-aea1bd924ea9",           # Incoming Only
    "block-9f9c16f6-da15-4e56-a08a-2a036e48832a",     # Is Media Message?
    "block-b0a9fec7-4938-4c4c-bf17-87c193b468b1",     # Media Handoff
]
```

### Profile: PATH_ISOLATION — Text (Agent Disabled)

Disable 4 blocks, keep 18:

```python
disable_blocks = [
    "block-9f9c16f6-da15-4e56-a08a-2a036e48832a",     # Is Media Message?
    "block-b0a9fec7-4938-4c4c-bf17-87c193b468b1",     # Media Handoff
    "35a00fab-a271-4aa6-9ab9-87e69cd8ee59",           # Support Agent
    "3275b7a8-ac67-411a-bfe7-f139c90d877e",           # Send to Chatwoot
]

keep_blocks = [
    # All remaining 18 blocks (including Build Conversation Composite Key)
]
```

### Profile: FULL_INTEGRATION

Disable 1 block, keep 21:

```python
disable_blocks = [
    "3275b7a8-ac67-411a-bfe7-f139c90d877e",           # Send to Chatwoot
]

keep_blocks = [
    # All other 21 blocks
]
```

---

## Execution Order

Recommended order for running the complete test suite:

```
Phase 1: CONDITION_ONLY (13 scenarios)
├── CR-01 through CR-12, CR-14 (CR-13 was renumbered to MH-06)
├── Cheapest ($0.00), safest
├── Validates all routing logic
└── If any fail → STOP, fix routing before proceeding

Phase 2: PATH_ISOLATION — Media (6 scenarios)
├── MH-01 through MH-06
├── Moderate cost ($0.00-0.01)
├── Validates media handoff function
└── If any fail → check Media Handoff function code

Phase 3: PATH_ISOLATION — Text (3 scenarios)
├── TF-01 through TF-03
├── Low cost ($0.00), but may involve wait blocks
├── Validates text pipeline before agent
└── If any fail → check pipeline block configuration

Phase 4: FULL_INTEGRATION (2 scenarios)
├── FI-01, FI-02
├── Highest cost ($0.01-0.05 each)
├── Validates end-to-end behavior
└── Run only after Phases 1-3 pass
```

**Total:** 24 scenarios (can expand with new scenarios as features are added)
**Estimated Cost:** $0.02–0.10 for full suite
**Estimated Time:** 5–15 minutes (depends on wait blocks and API response times)
