---
name: sim-knowledge-bases
description: Use when building RAG (Retrieval Augmented Generation) workflows - setting up knowledge bases, configuring document chunking, implementing semantic search, and optimizing retrieval relevance.
---

# Sim Knowledge Bases

Guide for building RAG workflows with knowledge bases in Sim.

## Overview

Sim's knowledge base system enables semantic search over your documents using vector embeddings. Documents are chunked, embedded, and stored for efficient retrieval.

## Knowledge Base Setup

### Creating a Knowledge Base

1. Navigate to Knowledge Bases in the Sim UI
2. Click "Create Knowledge Base"
3. Configure:
   - Name and description
   - Embedding model (OpenAI, Cohere, etc.)
   - Chunking strategy

### Uploading Documents

Supported formats:
- **Text**: `.txt`, `.md`, `.csv`
- **Documents**: `.pdf`, `.docx`, `.doc`
- **Web**: URLs for web scraping
- **Code**: `.py`, `.js`, `.ts`, etc.

## RAG Workflow Pattern

```
[Trigger] → [Agent with Knowledge Base] → [Response]
```

### Basic RAG Agent Setup

```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "agent",
    name: "Knowledge Agent",
    position: { x: 300, y: 100 },
    data: {
      model: "gpt-4",
      knowledgeBaseId: "kb_abc123",
      systemPrompt: `You are a helpful assistant with access to our documentation. 
Answer questions using the retrieved context. If the context doesn't contain 
the answer, say so.`
    }
  }]
})
```

### Using knowledge_search Tool

For more control, use the explicit search tool:

```javascript
{
  type: "agent",
  data: {
    tools: ["knowledge_search"],
    systemPrompt: `Search the knowledge base for relevant information, 
then synthesize an answer from the results.`
  }
}
```

### Search Parameters

```typescript
{
  knowledgeBaseId: string,  // Required: KB identifier
  query: string,            // Search query (optional with tag filters)
  topK: number,             // Results count (1-100, default: 10)
  tagFilters: [             // Optional metadata filters
    { tagName: "category", tagValue: "api-docs" },
    { tagName: "version", tagValue: "2.0" }
  ]
}
```

## Search Response Structure

```typescript
{
  results: [
    {
      documentId: string,
      documentName: string,
      content: string,       // Chunk content
      chunkIndex: number,
      similarity: number,    // 0-1 similarity score
      metadata: {
        tags: { category: "...", ... }
      }
    }
  ],
  query: string,
  totalResults: number
}
```

## Advanced RAG Patterns

### Multi-Step RAG
```
[Query] → [Search KB] → [Rerank] → [Agent Answer]
```

### Hybrid Search
Combine semantic search with keyword filters:
```javascript
{
  query: "authentication flow",
  tagFilters: [
    { tagName: "docType", tagValue: "tutorial" }
  ]
}
```

### Context Windowing
For large documents, retrieve surrounding chunks:
```javascript
// Agent prompt
`When a relevant chunk is found, also consider the chunks 
before and after it for complete context.`
```

## Best Practices

1. **Chunk size matters** - 500-1000 tokens is usually optimal
2. **Overlap chunks** - 10-20% overlap prevents context loss
3. **Add metadata** - Tags enable filtered search
4. **Quality over quantity** - Clean, relevant documents improve results
5. **Test retrieval** - Verify top results before production

See `references/chunking-strategies.md` and `references/vector-search.md` for details.
