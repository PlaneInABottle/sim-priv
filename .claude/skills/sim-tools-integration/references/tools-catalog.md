# Tools Catalog

Complete reference of 40+ tools available in Sim.

## Communication Tools

### Slack
| Tool ID | Description |
|---------|-------------|
| `slack_message` | Send message to channel/user |
| `slack_message_reader` | Read messages from channel |
| `slack_update_message` | Update existing message |
| `slack_delete_message` | Delete a message |
| `slack_add_reaction` | Add emoji reaction |
| `slack_list_channels` | List workspace channels |
| `slack_list_members` | List channel members |
| `slack_list_users` | List workspace users |
| `slack_get_user` | Get user details |
| `slack_canvas` | Create/update canvas |
| `slack_download` | Download file from Slack |

### Discord
| Tool ID | Description |
|---------|-------------|
| `discord_send_message` | Send message to channel |
| `discord_get_messages` | Read channel messages |
| `discord_edit_message` | Edit a message |
| `discord_delete_message` | Delete a message |
| `discord_add_reaction` | Add reaction |
| `discord_remove_reaction` | Remove reaction |
| `discord_create_thread` | Create thread |
| `discord_create_channel` | Create channel |
| `discord_update_channel` | Update channel settings |
| `discord_delete_channel` | Delete channel |
| `discord_create_role` | Create role |
| `discord_assign_role` | Assign role to member |
| `discord_kick_member` | Kick member |
| `discord_ban_member` | Ban member |
| `discord_create_webhook` | Create webhook |
| `discord_execute_webhook` | Send via webhook |

### Microsoft Teams
| Tool ID | Description |
|---------|-------------|
| `microsoft_teams_write_channel` | Send channel message |
| `microsoft_teams_write_chat` | Send chat message |
| `microsoft_teams_read_channel` | Read channel messages |
| `microsoft_teams_read_chat` | Read chat messages |
| `microsoft_teams_update_channel_message` | Update channel message |
| `microsoft_teams_delete_channel_message` | Delete channel message |
| `microsoft_teams_reply_to_message` | Reply to message |
| `microsoft_teams_set_reaction` | Add reaction |
| `microsoft_teams_list_team_members` | List team members |

### Email
| Tool ID | Description |
|---------|-------------|
| `gmail_send` | Send email |
| `gmail_read` | Read email by ID |
| `gmail_search` | Search emails |
| `gmail_draft` | Create draft |
| `gmail_archive` | Archive email |
| `gmail_mark_read` | Mark as read |
| `gmail_add_label` | Add label |
| `outlook_send` | Send email |
| `outlook_read` | Read email |
| `outlook_draft` | Create draft |
| `resend_send` | Send via Resend |
| `sendgrid_send` | Send via SendGrid |

### SMS/Voice
| Tool ID | Description |
|---------|-------------|
| `twilio_send_sms` | Send SMS |
| `twilio_voice` | Make voice call |
| `whatsapp_send_message` | Send WhatsApp message |

## Productivity Tools

### Linear
| Tool ID | Description |
|---------|-------------|
| `linear_create_issue` | Create issue |
| `linear_update_issue` | Update issue |
| `linear_get_issue` | Get issue details |
| `linear_read_issues` | List issues |
| `linear_search_issues` | Search issues |
| `linear_archive_issue` | Archive issue |
| `linear_create_comment` | Add comment |
| `linear_create_project` | Create project |
| `linear_list_teams` | List teams |
| `linear_list_labels` | List labels |
| `linear_add_label_to_issue` | Add label |

### Jira
| Tool ID | Description |
|---------|-------------|
| `jira_create_issue` | Create issue |
| `jira_update_issue` | Update issue |
| `jira_get_issue` | Get issue |
| `jira_search_issues` | JQL search |
| `jira_add_comment` | Add comment |
| `jira_transition_issue` | Change status |

### Notion
| Tool ID | Description |
|---------|-------------|
| `notion_create_page` | Create page |
| `notion_update_page` | Update page |
| `notion_query_database` | Query database |
| `notion_append_blocks` | Add content blocks |

### Google Workspace
| Tool ID | Description |
|---------|-------------|
| `google_calendar_create_event` | Create event |
| `google_calendar_list_events` | List events |
| `google_calendar_update_event` | Update event |
| `google_sheets_read` | Read spreadsheet |
| `google_sheets_append` | Append rows |
| `google_sheets_update` | Update cells |
| `google_docs_create` | Create document |
| `google_docs_read` | Read document |
| `google_drive_list` | List files |
| `google_drive_upload` | Upload file |
| `google_drive_download` | Download file |

## Data & Storage Tools

### PostgreSQL
| Tool ID | Description |
|---------|-------------|
| `postgresql_query` | Execute SELECT |
| `postgresql_insert` | Insert rows |
| `postgresql_update` | Update rows |
| `postgresql_delete` | Delete rows |
| `postgresql_execute` | Run raw SQL |

### DynamoDB
| Tool ID | Description |
|---------|-------------|
| `dynamodb_get` | Get item |
| `dynamodb_put` | Put item |
| `dynamodb_query` | Query items |
| `dynamodb_scan` | Scan table |
| `dynamodb_update` | Update item |
| `dynamodb_delete` | Delete item |

### MongoDB
| Tool ID | Description |
|---------|-------------|
| `mongodb_query` | Find documents by query |
| `mongodb_insert` | Insert documents |
| `mongodb_update` | Update documents |
| `mongodb_delete` | Delete documents |
| `mongodb_execute` | Execute raw MongoDB commands |

### S3
| Tool ID | Description |
|---------|-------------|
| `s3_get_object` | Get object |
| `s3_put_object` | Upload object |
| `s3_list_objects` | List objects |
| `s3_delete_object` | Delete object |
| `s3_copy_object` | Copy object |

### Vector Databases
| Tool ID | Description |
|---------|-------------|
| `pinecone_upsert` | Upsert vectors |
| `pinecone_query` | Query vectors |
| `qdrant_upsert` | Upsert points |
| `qdrant_search` | Search points |

## Developer Tools

### GitHub
| Tool ID | Description |
|---------|-------------|
| `github_create_issue` | Create issue |
| `github_update_issue` | Update issue |
| `github_create_pr` | Create pull request |
| `github_list_prs` | List pull requests |
| `github_create_comment` | Add comment |
| `github_get_file` | Get file contents |

### HTTP/API
| Tool ID | Description |
|---------|-------------|
| `http_request` | Generic HTTP request (supports GET, POST, PUT, DELETE, PATCH) |

## AI/ML Tools

### Knowledge Search
| Tool ID | Description |
|---------|-------------|
| `knowledge_search` | Semantic search in knowledge base |

### Embeddings
| Tool ID | Description |
|---------|-------------|
| `openai_embeddings` | Generate embeddings |

### Search
| Tool ID | Description |
|---------|-------------|
| `serper_search` | Google search via Serper |
| `tavily_search` | AI-powered web search |
| `exa_search` | Neural search |
| `perplexity_search` | Perplexity AI search |

## Tool Parameter Types

### Common Parameter Patterns

```typescript
// String with validation
{
  type: "string",
  required: true,
  description: "Channel ID or name"
}

// Optional with default
{
  type: "number",
  required: false,
  default: 10,
  description: "Maximum results to return"
}

// Array of objects
{
  type: "array",
  items: {
    type: "object",
    properties: {
      key: { type: "string" },
      value: { type: "string" }
    }
  }
}

// Enum selection
{
  type: "string",
  enum: ["low", "medium", "high", "urgent"],
  description: "Priority level"
}
```

### Output Structures

All tools return consistent output:

```typescript
{
  success: boolean,
  output: {
    // Tool-specific response data
  },
  error?: string  // Only on failure
}
```
