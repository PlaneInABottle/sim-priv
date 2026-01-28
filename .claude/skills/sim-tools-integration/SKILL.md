---
name: sim-tools-integration
description: Use when integrating external tools and services (Discord, Slack, Teams, Gmail, S3, PostgreSQL, Linear, etc.) into Sim workflows - configuring authentication, mapping parameters, and understanding tool schemas.
---

# Sim Tools Integration

Guide for integrating 40+ pre-built tools into Sim workflows.

## Overview

Sim provides ready-to-use tools for integrating with external services. Each tool has a defined schema with parameters, authentication requirements, and output structures.

## Tool Categories

### Communication
- **Slack** - Messages, channels, reactions, file downloads
- **Discord** - Messages, channels, roles, webhooks, threads
- **Microsoft Teams** - Channel/chat messages, reactions, members
- **Gmail** - Send, read, search, labels, archive
- **Outlook** - Send, read, draft, mark read/unread
- **Twilio** - SMS, voice calls
- **WhatsApp** - Messages via WhatsApp Business API

### Productivity
- **Linear** - Issues, projects, cycles, labels, comments
- **Jira** - Issues, projects, sprints
- **Asana** - Tasks, projects, workspaces
- **Trello** - Cards, boards, lists
- **Notion** - Pages, databases, blocks
- **Google Calendar** - Events, calendars
- **Google Docs/Sheets/Drive** - Documents, spreadsheets, files

### Data & Storage
- **PostgreSQL** - Query, insert, update, delete
- **DynamoDB** - Get, put, query, scan, update
- **MongoDB** - Find, insert, update, aggregate
- **S3** - Get, put, list, delete, copy objects
- **Supabase** - Database queries, storage
- **Pinecone/Qdrant** - Vector database operations

### Developer Tools
- **GitHub** - Issues, PRs, repos, actions
- **GitLab** - Issues, merge requests, pipelines

## Using Tools in Workflows

### Adding a Tool Block

```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "agent",
    name: "Slack Notifier",
    position: { x: 300, y: 100 },
    data: {
      model: "gpt-4",
      tools: ["slack_message"],  // Tool ID
      systemPrompt: "Send notifications to Slack"
    }
  }]
})
```

### Tool Configuration Pattern

Each tool follows a consistent schema:

```typescript
{
  id: string           // Unique tool identifier
  name: string         // Display name
  description: string  // What the tool does
  params: {            // Input parameters
    paramName: {
      type: string     // "string" | "number" | "boolean" | "array" | "object"
      required: boolean
      description: string
    }
  }
  outputs: {           // Output structure
    outputName: {
      type: string
      description: string
    }
  }
}
```

### Referencing Tool Outputs

Access tool outputs in subsequent blocks:

```
{{blocks.slackNotifier.output.messageId}}
{{blocks.gmailSender.output.threadId}}
{{blocks.linearCreateIssue.output.id}}
```

## Authentication Types

### OAuth (Most services)
- Google services (Gmail, Calendar, Drive, Sheets)
- Slack, Discord, Microsoft Teams
- Linear, Jira, Asana, Notion
- GitHub, GitLab

### API Keys
- OpenAI, Anthropic (LLM providers)
- Twilio, SendGrid
- AWS services (S3, DynamoDB)
- Stripe

### Connection Strings
- PostgreSQL, MySQL, MongoDB
- Redis

See `references/auth-setup.md` for detailed authentication setup.

## Common Patterns

### Send Slack Notification on Condition
```javascript
// Agent with Slack tool
{
  tools: ["slack_message"],
  systemPrompt: `When the analysis is complete, send a Slack message to #alerts channel with the summary.`
}
```

### Create Linear Issue from Email
```javascript
// Chain Gmail read → Agent → Linear create
// Agent prompt:
`Extract the issue details from the email and create a Linear issue:
- Title: Email subject
- Description: Email body summary
- Priority: Infer from content urgency`
```

### Sync Data Between Services
```javascript
// Agent with multiple tools
{
  tools: ["notion_query", "google_sheets_append"],
  systemPrompt: `Query the Notion database for new entries and append them to the Google Sheet.`
}
```

## Best Practices

1. **Use specific tool grants** - Only enable tools needed for the task
2. **Handle rate limits** - Add delays for bulk operations
3. **Validate credentials** - Test auth before complex workflows
4. **Map errors gracefully** - Use condition blocks for error handling
5. **Batch operations** - Use loops for multiple items

See `references/tools-catalog.md` for the complete tool reference.
