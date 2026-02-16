# Complete Payload Examples

Full Chatwoot webhook payload examples for Sim workflow testing.
For the base template, scenario overrides, and variable reference, see `payload-templates.md`.

---

## Table of Contents

1. [S-01: Text Greeting](#example-1-text-greeting-s-01)
2. [S-04: Voice Message](#example-2-voice-message-s-04)
3. [S-09: Image with Text](#example-3-image-with-text-s-09)
4. [S-07: Outgoing Message](#example-4-outgoing-message-s-07)
5. [S-14: Mixed Audio+Image](#example-5-mixed-audioimages-14)
6. [S-15: Team-Assigned Conversation](#example-6-team-assigned-conversation-s-15)

---

## Example 1: Text Greeting (S-01)

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

## Example 2: Voice Message (S-04)

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

## Example 3: Image with Text (S-09)

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

## Example 4: Outgoing Message (S-07)

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

## Example 5: Mixed Audio+Image (S-14)

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

## Example 6: Team-Assigned Conversation (S-15)

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
