# Chunking Strategies

Guide for document processing and chunking in Sim knowledge bases.

## Why Chunking Matters

Large documents must be split into smaller pieces (chunks) for:
- Embedding model token limits
- Relevant context retrieval
- Cost-effective searches

## Chunking Methods

### Fixed-Size Chunking
Splits by character or token count.

**Best for:** Uniform content, code files

```
Chunk Size: 500-1000 tokens
Overlap: 50-100 tokens (10-20%)
```

**Pros:** Simple, predictable
**Cons:** May split mid-sentence/concept

### Semantic Chunking
Splits at natural boundaries (paragraphs, sections).

**Best for:** Documentation, articles, markdown

**Pros:** Preserves context
**Cons:** Variable chunk sizes

### Recursive Chunking
Hierarchically splits using multiple separators.

```
Level 1: Split by headers (##)
Level 2: Split by paragraphs
Level 3: Split by sentences
Level 4: Split by tokens (fallback)
```

**Best for:** Structured documents, markdown, HTML

## Recommended Settings by Document Type

| Document Type | Chunk Size | Overlap | Method |
|--------------|-----------|---------|--------|
| API Docs | 500 tokens | 50 | Semantic |
| Tutorials | 800 tokens | 80 | Recursive |
| Code Files | 400 tokens | 40 | Fixed |
| PDFs | 600 tokens | 60 | Semantic |
| FAQs | 300 tokens | 30 | Semantic |
| Long Articles | 1000 tokens | 100 | Recursive |

## Chunk Size Guidelines

### Too Small (< 200 tokens)
- Loses context
- More API calls needed
- Higher retrieval noise

### Optimal (400-1000 tokens)
- Complete thoughts/concepts
- Good retrieval precision
- Balanced cost

### Too Large (> 1500 tokens)
- Dilutes relevance
- May hit embedding limits
- Returns irrelevant content

## Overlap Configuration

Overlap prevents losing context at boundaries:

```
Document: "The API uses OAuth 2.0 for authentication. Tokens expire after 24 hours."

Without overlap:
Chunk 1: "The API uses OAuth 2.0 for"
Chunk 2: "authentication. Tokens expire after 24 hours."

With 20% overlap:
Chunk 1: "The API uses OAuth 2.0 for authentication."
Chunk 2: "for authentication. Tokens expire after 24 hours."
```

**Recommendation:** 10-20% overlap

## Metadata Enrichment

Add metadata during chunking for filtered retrieval:

```javascript
{
  content: "chunk text...",
  metadata: {
    source: "api-reference.md",
    section: "Authentication",
    pageNumber: 12,
    category: "api-docs",
    version: "2.0"
  }
}
```

### Useful Metadata Fields
- `source` - Original document name/path
- `section` - Document section/header
- `category` - Content classification
- `date` - Document date/version
- `author` - Content author
- `language` - Programming language (for code)

## Pre-Processing Best Practices

### Before Chunking
1. **Remove boilerplate** - Headers, footers, navigation
2. **Clean formatting** - Extra whitespace, special characters
3. **Extract text** - Convert PDFs/docs to clean text
4. **Preserve structure** - Keep headings, lists

### Document Cleaning
```
Remove:
- Page numbers
- Repeated headers/footers
- Table of contents
- Index pages
- Watermarks

Preserve:
- Headings hierarchy
- Code blocks
- Lists and bullets
- Tables (convert to text)
```

## Code File Handling

For code files, chunk by logical units:

```
Priority order:
1. Function/method boundaries
2. Class boundaries
3. Fixed token size (fallback)
```

Include context:
```python
# Chunk includes:
# - Function signature
# - Docstring
# - Function body
# - Import context (if relevant)
```

## Troubleshooting

### Poor Retrieval Quality
- Increase chunk size
- Add more overlap
- Improve metadata tags
- Clean source documents

### Too Many Results
- Decrease chunk size
- Add tag filters
- Increase similarity threshold

### Missing Context
- Increase overlap percentage
- Use recursive chunking
- Include section headers in chunks
