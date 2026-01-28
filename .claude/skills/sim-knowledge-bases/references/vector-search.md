# Vector Search & Relevance

Guide for semantic search and optimizing retrieval in Sim knowledge bases.

## How Vector Search Works

1. **Query Embedding** - Your query is converted to a vector
2. **Similarity Search** - Find vectors closest to query
3. **Ranking** - Results sorted by similarity score
4. **Return** - Top K results returned with content

## Similarity Metrics

### Cosine Similarity
Measures angle between vectors. Range: 0-1

- **1.0** - Identical meaning
- **0.8+** - Highly relevant
- **0.6-0.8** - Moderately relevant
- **< 0.5** - Likely not relevant

### Interpreting Scores

| Score | Meaning | Confidence |
|-------|---------|------------|
| 0.9+ | Near exact match | Very High |
| 0.8-0.9 | Strongly related | High |
| 0.7-0.8 | Related topic | Medium |
| 0.6-0.7 | Tangentially related | Low |
| < 0.6 | Probably not relevant | Very Low |

## Search Configuration

### topK Parameter
Number of results to return.

```javascript
// Precise answers - few, high-quality results
{ topK: 3 }

// Comprehensive research - more results
{ topK: 10 }

// Exploratory - broad coverage
{ topK: 20 }
```

**Recommendation:** Start with `topK: 5`, adjust based on results

### Tag Filters

Filter by metadata before similarity search:

```javascript
{
  query: "authentication",
  tagFilters: [
    { tagName: "category", tagValue: "api" },
    { tagName: "version", tagValue: "v2" }
  ]
}
```

**Filter Operators:**
- `eq` - Equals (default)
- `ne` - Not equals
- `contains` - Text contains
- `gt`/`lt` - Greater/less than (numbers)
- `between` - Range (numbers, dates)

## Query Optimization

### Write Effective Queries

**Good queries:**
- "How do I authenticate with OAuth 2.0?"
- "Python code example for file upload"
- "Error handling best practices in API calls"

**Poor queries:**
- "auth" (too vague)
- "how to" (no context)
- "the thing with the API" (unclear)

### Query Expansion
For better recall, expand queries:

```javascript
// Agent prompt
`Before searching, expand the user's query with:
- Synonyms
- Related technical terms
- Common variations`
```

### Hypothetical Document Embedding (HyDE)
Generate hypothetical answer, then search:

```javascript
// Step 1: Generate hypothetical answer
`If this question were answered in our docs, the answer would be: ...`

// Step 2: Search using hypothetical answer as query
```

## Relevance Tuning

### Boosting Strategies

**Recency Boost** - Prefer recent documents
```javascript
tagFilters: [
  { tagName: "updatedDate", operator: "gt", tagValue: "2024-01-01" }
]
```

**Authority Boost** - Prefer official docs
```javascript
tagFilters: [
  { tagName: "source", tagValue: "official-docs" }
]
```

### Re-ranking
After initial retrieval, re-rank with LLM:

```
Agent Prompt:
"Given these search results, rank them by relevance to the question.
Return only the most relevant 3 results."
```

## Multi-Query RAG

For complex questions, use multiple searches:

```javascript
// Complex question: "Compare OAuth and API keys for authentication"

// Query 1: OAuth authentication
// Query 2: API key authentication  
// Query 3: Authentication comparison

// Combine results, deduplicate, synthesize answer
```

## Handling No Results

```javascript
// Agent prompt
`If knowledge base search returns no relevant results:
1. Acknowledge you don't have that information
2. Suggest related topics you can help with
3. Recommend where to find the answer`
```

## Performance Optimization

### Reduce Latency
- Use appropriate topK (not too high)
- Add tag filters to narrow search space
- Cache common queries

### Improve Accuracy
- Quality source documents
- Proper chunk sizes
- Relevant metadata tags
- Query preprocessing

## Common Issues

### Low Similarity Scores
- Query too vague → Be more specific
- Wrong vocabulary → Use domain terms
- Missing content → Add relevant documents

### Irrelevant Top Results
- Chunk size too large → Reduce size
- Missing context → Add overlap
- Ambiguous query → Add context

### Duplicate Results
- Chunks too small → Increase size
- Too much overlap → Reduce overlap
- Deduplicate by documentId
