# Payload Templates

Base Chatwoot webhook templates and scenario-specific overrides for testing
Sim workflows triggered by Chatwoot webhooks.

---

## Table of Contents

1. [Base Template](#base-template)
2. [Scenario Override Table](#scenario-override-table)
3. [Complete Payload Examples](#complete-payload-examples)
4. [Variable Reference](#variable-reference)
5. [Creating New Scenarios](#creating-new-scenarios)

---

## Base Template

This is the production-grade Chatwoot webhook payload structure. All test scenarios
start from this base and override specific fields.

```json
{
    "event": "message_created",
    "id": {{MESSAGE_ID}},
    "content": "{{MESSAGE_CONTENT}}",
    "content_type": "{{CONTENT_TYPE}}",
    "message_type": "{{MESSAGE_TYPE}}",
    "created_at": "{{CREATED_AT}}",
    "private": false,
    "source_id": null,
    "content_attributes": {},
    "sender": {
        "id": {{SENDER_ID}},
        "name": "{{SENDER_NAME}}",
        "phone_number": "{{SENDER_PHONE}}",
        "email": null,
        "type": "contact"
    },
    "conversation": {
        "additional_attributes": {},
        "can_reply": true,
        "channel": "Channel::Api",
        "contact_inbox": {
            "id": {{CONTACT_INBOX_ID}},
            "source_id": "{{CONTACT_SOURCE_ID}}"
        },
        "id": {{CONVERSATION_ID}},
        "inbox_id": {{INBOX_ID}},
        "messages": [],
        "meta": {
            "sender": {
                "id": {{SENDER_ID}},
                "name": "{{SENDER_NAME}}",
                "phone_number": "{{SENDER_PHONE}}",
                "type": "contact"
            }
        },
        "status": "pending",
        "unread_count": 1
    },
    "account": {
        "id": {{ACCOUNT_ID}},
        "name": "{{ACCOUNT_NAME}}"
    },
    "attachments": []
}
```

### Default Values for Testing

When no specific value is needed, use these defaults:

| Variable | Default Value | Notes |
|----------|--------------|-------|
| `MESSAGE_ID` | `99001` | Arbitrary, unique per test |
| `MESSAGE_CONTENT` | `"Merhaba"` | Turkish greeting |
| `CONTENT_TYPE` | `"text"` | Standard text message |
| `MESSAGE_TYPE` | `"incoming"` | Customer-sent message |
| `CREATED_AT` | `"2026-02-11T10:00:00.000Z"` | ISO 8601 timestamp |
| `SENDER_ID` | `12345` | Test contact ID |
| `SENDER_NAME` | `"Test Müşteri"` | Turkish: "Test Customer" |
| `SENDER_PHONE` | `"+905551234567"` | Turkish mobile format |
| `CONTACT_INBOX_ID` | `100` | Arbitrary |
| `CONTACT_SOURCE_ID` | `"wa:905551234567"` | WhatsApp source format |
| `CONVERSATION_ID` | `42` | Arbitrary conversation |
| `INBOX_ID` | `1` | Default inbox |
| `ACCOUNT_ID` | `1` | Default account |
| `ACCOUNT_NAME` | `"Kamatas"` | Company name |

---

## Scenario Override Table

Each scenario overrides specific fields from the base template. Only overridden
fields are shown — all other fields use base defaults.

| # | Scenario | `message_type` | `content` | `content_type` | `attachments` | Key Purpose |
|---|----------|---------------|-----------|----------------|---------------|-------------|
| S-01 | Text greeting | `"incoming"` | `"Merhaba"` | `"text"` | `[]` | Basic text routing |
| S-02 | Product inquiry | `"incoming"` | `"Sineklik fiyatları nedir?"` | `"text"` | `[]` | Product question routing |
| S-03 | Order status | `"incoming"` | `"Siparişim nerede?"` | `"text"` | `[]` | Order inquiry routing |
| S-04 | Voice message | `"incoming"` | `""` | `"text"` | `[voice_attachment]` | Voice → media path |
| S-05 | Image message | `"incoming"` | `""` | `"text"` | `[image_attachment]` | Image → media path |
| S-06 | Video message | `"incoming"` | `""` | `"text"` | `[video_attachment]` | Video → media path |
| S-07 | Outgoing message | `"outgoing"` | `"Merhaba, size nasıl yardımcı olabilirim?"` | `"text"` | `[]` | Should be dropped |
| S-08 | Activity message | `"activity"` | `"Conversation resolved"` | `"text"` | `[]` | Should be dropped |
| S-09 | Text with image | `"incoming"` | `"Bu ölçülere sineklik olur mu?"` | `"text"` | `[image_attachment]` | Text + media combo |
| S-10 | Document attachment | `"incoming"` | `""` | `"text"` | `[document_attachment]` | Non-media file |
| S-11 | Multiple attachments | `"incoming"` | `""` | `"text"` | `[image_att, image_att]` | Multi-image handling |
| S-12 | Empty content no attach | `"incoming"` | `""` | `"text"` | `[]` | Edge case: empty msg |
| S-13 | Measurement question | `"incoming"` | `"Sineklik ölçüsünü nasıl alırım?"` | `"text"` | `[]` | Measurement routing |
| S-14 | Mixed audio+image | `"incoming"` | `""` | `"text"` | `[voice_attachment, image_attachment]` | Audio > image priority |
| S-15 | Team-assigned conversation | `"incoming"` | `"Merhaba"` | `"text"` | `[]` | Team → dropped (override: `conversation.meta.team`) |

### Attachment Objects

Use these pre-built attachment objects in the `attachments` array:

**Voice Attachment (`voice_attachment`):**
```json
{
    "id": 501,
    "message_id": 99001,
    "file_type": "audio",
    "account_id": 1,
    "data_url": "https://chatwoot-assets.example.com/voice_message_001.ogg",
    "extension": "ogg",
    "thumb_url": null
}
```

**Image Attachment (`image_attachment`):**
```json
{
    "id": 502,
    "message_id": 99001,
    "file_type": "image",
    "account_id": 1,
    "data_url": "https://chatwoot-assets.example.com/photo_001.jpg",
    "extension": "jpg",
    "thumb_url": "https://chatwoot-assets.example.com/photo_001_thumb.jpg"
}
```

**Video Attachment (`video_attachment`):**
```json
{
    "id": 503,
    "message_id": 99001,
    "file_type": "video",
    "account_id": 1,
    "data_url": "https://chatwoot-assets.example.com/video_001.mp4",
    "extension": "mp4",
    "thumb_url": "https://chatwoot-assets.example.com/video_001_thumb.jpg"
}
```

**Document Attachment (`document_attachment`):**
```json
{
    "id": 504,
    "message_id": 99001,
    "file_type": "file",
    "account_id": 1,
    "data_url": "https://chatwoot-assets.example.com/document_001.pdf",
    "extension": "pdf",
    "thumb_url": null
}
```

---

## Complete Payload Examples

### Example 1: Text Greeting (S-01)

A standard incoming text message — the most common scenario.

```json
{
    "event": "message_created",
    "id": 99001,
    "content": "Merhaba",
    "content_type": "text",
    "message_type": "incoming",
    "created_at": "2026-02-11T10:00:00.000Z",
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
        "contact_inbox": {
            "id": 100,
            "source_id": "wa:905551234567"
        },
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
    "account": {
        "id": 1,
        "name": "Kamatas"
    },
    "attachments": []
}
```

**Expected routing:** Incoming Only (IF) → text processing path

---

### Example 2: Voice Message (S-04)

A voice note from WhatsApp — triggers the media handoff path.

```json
{
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
        "contact_inbox": {
            "id": 100,
            "source_id": "wa:905551234567"
        },
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
    "account": {
        "id": 1,
        "name": "Kamatas"
    },
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
```

**Expected routing:** Incoming Only (ELSE) → Is Media Message? (IF) → Media Handoff

---

### Example 3: Image with Text (S-09)

Customer sends a photo with a text question — combines text + media.

```json
{
    "event": "message_created",
    "id": 99009,
    "content": "Bu ölçülere sineklik olur mu?",
    "content_type": "text",
    "message_type": "incoming",
    "created_at": "2026-02-11T10:02:00.000Z",
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
        "contact_inbox": {
            "id": 100,
            "source_id": "wa:905551234567"
        },
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
    "account": {
        "id": 1,
        "name": "Kamatas"
    },
    "attachments": [
        {
            "id": 502,
            "message_id": 99009,
            "file_type": "image",
            "account_id": 1,
            "data_url": "https://chatwoot-assets.example.com/measurement_photo.jpg",
            "extension": "jpg",
            "thumb_url": "https://chatwoot-assets.example.com/measurement_photo_thumb.jpg"
        }
    ]
}
```

**Expected routing:** Incoming Only (ELSE) → Is Media Message? (IF) → Media Handoff
> Even though there's text content, the presence of a media attachment routes to media path.

---

### Example 4: Outgoing Message (S-07)

A bot or agent response — should be dropped by the workflow (no processing).

```json
{
    "event": "message_created",
    "id": 99007,
    "content": "Merhaba, size nasıl yardımcı olabilirim?",
    "content_type": "text",
    "message_type": "outgoing",
    "created_at": "2026-02-11T10:03:00.000Z",
    "private": false,
    "source_id": null,
    "content_attributes": {},
    "sender": {
        "id": 99,
        "name": "Kamatas Bot",
        "phone_number": null,
        "email": null,
        "type": "user"
    },
    "conversation": {
        "additional_attributes": {},
        "can_reply": true,
        "channel": "Channel::Api",
        "contact_inbox": {
            "id": 100,
            "source_id": "wa:905551234567"
        },
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
        "unread_count": 0
    },
    "account": {
        "id": 1,
        "name": "Kamatas"
    },
    "attachments": []
}
```

**Expected routing:** Incoming Only (ELSE) → Is Media Message? (ELSE) → dropped (no further blocks execute)

---

### Example 5: Mixed Audio+Image (S-14)

Customer sends a voice note along with an image — tests media priority logic (audio > image).

```json
{
    "event": "message_created",
    "id": 99014,
    "content": "",
    "content_type": "text",
    "message_type": "incoming",
    "created_at": "2026-02-11T10:04:00.000Z",
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
        "contact_inbox": {
            "id": 100,
            "source_id": "wa:905551234567"
        },
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
    "account": {
        "id": 1,
        "name": "Kamatas"
    },
    "attachments": [
        {
            "id": 501,
            "message_id": 99014,
            "file_type": "audio",
            "account_id": 1,
            "data_url": "https://chatwoot-assets.example.com/voice_message_002.ogg",
            "extension": "ogg",
            "thumb_url": null
        },
        {
            "id": 502,
            "message_id": 99014,
            "file_type": "image",
            "account_id": 1,
            "data_url": "https://chatwoot-assets.example.com/photo_002.jpg",
            "extension": "jpg",
            "thumb_url": "https://chatwoot-assets.example.com/photo_002_thumb.jpg"
        }
    ]
}
```

**Expected routing:** Incoming Only (ELSE) → Is Media Message? (IF) → Media Handoff
> Audio takes priority over image. mediaType resolves to "voice".

---

### Example 6: Team-Assigned Conversation (S-15)

An incoming text message from a conversation assigned to a team — should be dropped by Incoming Only.

```json
{
    "event": "message_created",
    "id": 99015,
    "content": "Merhaba",
    "content_type": "text",
    "message_type": "incoming",
    "created_at": "2026-02-11T10:05:00.000Z",
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
        "contact_inbox": {
            "id": 100,
            "source_id": "wa:905551234567"
        },
        "id": 42,
        "inbox_id": 1,
        "messages": [],
        "meta": {
            "sender": {
                "id": 12345,
                "name": "Test Müşteri",
                "phone_number": "+905551234567",
                "type": "contact"
            },
            "team": {
                "id": 1,
                "name": "Support Team"
            }
        },
        "status": "pending",
        "unread_count": 1
    },
    "account": {
        "id": 1,
        "name": "Kamatas"
    },
    "attachments": []
}
```

**Expected routing:** Incoming Only (ELSE) → dropped (hasTeam=true)
> Team-assigned conversations are dropped. Only personal conversations (hasTeam=false) are processed.

---

## Variable Reference

### Payload Variables

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `{{MESSAGE_ID}}` | integer | Unique message identifier. Use sequential IDs per test (99001, 99002...) | `99001` |
| `{{MESSAGE_CONTENT}}` | string | Message text. Empty string `""` for media-only messages. Turkish text for Kamatas. | `"Sineklik fiyatları nedir?"` |
| `{{CONTENT_TYPE}}` | string | Always `"text"` for Chatwoot webhooks (even for media messages) | `"text"` |
| `{{MESSAGE_TYPE}}` | string | Direction: `"incoming"` (customer), `"outgoing"` (bot/agent), `"activity"` (system) | `"incoming"` |
| `{{CREATED_AT}}` | string | ISO 8601 timestamp. Use test execution time or fixed value. | `"2026-02-11T10:00:00.000Z"` |
| `{{SENDER_ID}}` | integer | Chatwoot contact ID for the sender. Consistent within a test session. | `12345` |
| `{{SENDER_NAME}}` | string | Display name. Use Turkish names for Kamatas tests. | `"Ahmet Yılmaz"` |
| `{{SENDER_PHONE}}` | string | Phone in E.164 format with Turkish country code (+90). | `"+905551234567"` |
| `{{CONVERSATION_ID}}` | integer | Chatwoot conversation ID. Same ID simulates messages in same thread. | `42` |
| `{{INBOX_ID}}` | integer | Chatwoot inbox ID. Usually `1` for WhatsApp channel. | `1` |
| `{{ACCOUNT_ID}}` | integer | Chatwoot account ID. Usually `1`. | `1` |
| `{{ACCOUNT_NAME}}` | string | Company name in Chatwoot. | `"Kamatas"` |

### Attachment Variables

| Variable | Type | Description | Values |
|----------|------|-------------|--------|
| `file_type` | string | Media type identifier | `"audio"`, `"image"`, `"video"`, `"file"` |
| `data_url` | string | URL to the media file | Any valid URL (not fetched during condition tests) |
| `extension` | string | File extension | `"ogg"`, `"jpg"`, `"mp4"`, `"pdf"` |
| `thumb_url` | string or null | Thumbnail URL (images/videos only) | URL or `null` |

### Media Type Detection

The workflow detects media messages by checking the `attachments` array and `file_type` values:

| `file_type` | Is Media? | Routes To |
|-------------|-----------|-----------|
| `"audio"` | ✅ Yes | Media Handoff |
| `"image"` | ✅ Yes | Media Handoff |
| `"video"` | ✅ Yes | Media Handoff |
| `"file"` | ⚠️ Depends | Check condition logic — may route to media or text |
| (no attachment) | ❌ No | Text path |

---

## Creating New Scenarios

### Step 1: Start from Base Template

Copy the base template and fill in default values.

### Step 2: Identify Override Fields

What makes this scenario unique? Typical overrides:

- **Different message type** → Change `message_type`
- **Media message** → Add to `attachments` array, set `content` to `""`
- **Specific question** → Change `content` to the Turkish text
- **Different sender** → Change `sender.id`, `sender.name`, `sender.phone_number`
- **Different conversation** → Change `conversation.id`

### Step 3: Assign a Scenario ID

Follow the pattern: `S-XX` where XX is the next sequential number.

### Step 4: Add to Scenario Override Table

Add a row to the table with only the overridden fields.

### Step 5: Document Expected Routing

For each scenario, document:
- Which condition path is taken at each decision point
- Which blocks should appear in the trace
- What output (if any) is expected

### Example: Adding a Sticker Scenario

```
Scenario: S-16 — Sticker message
Overrides:
  - content: ""
  - attachments: [{"file_type": "image", "data_url": "...", "extension": "webp"}]
Expected: Incoming Only (ELSE) → Is Media Message? (IF) → Media Handoff
Note: Stickers are delivered as image attachments with webp extension
```

### Step 6: Test the New Scenario

1. Run with CONDITION_ONLY profile first to verify routing
2. Then run with PATH_ISOLATION to verify the target path behavior
3. Add to the company test suite document
