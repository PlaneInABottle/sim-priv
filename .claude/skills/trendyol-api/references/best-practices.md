# Best Practices

Error handling, rate limiting, idempotency, and quality guidelines for the Trendyol Customer Questions API.

## Idempotent Processing

- **Always** check if a question has already been answered before submitting
- Use the question `id` as a deduplication key
- Store processed IDs in workflow variables or an external store
- Check `status !== 'WAITING_FOR_ANSWER'` before attempting to answer

## Rate Limiting

- Trendyol does **not** document explicit rate limits for the Q&A API
- Be **conservative**: poll no more frequently than every **3 minutes**
- Use exponential backoff on `429` or `5xx` errors
- Batch operations where possible (fetch page of 50, then process)

## Error Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad request (validation) | Check parameters/body |
| 401 | Unauthorized | Verify credentials |
| 403 | Forbidden | Check seller ID / permissions |
| 404 | Not found | Question ID may be invalid |
| 429 | Rate limited | Back off, retry after delay |
| 500+ | Server error | Retry with exponential backoff |

## Data Consistency

- Always use `startDate` / `endDate` params to scope your queries
- Remember the **2-week maximum** date range constraint
- For continuous polling, maintain a **watermark** (last processed timestamp)
- If your watermark is older than 2 weeks, reset it to `now - 14 days`

## Answer Quality Guidelines

- **Minimum 10 characters** — very short answers will be rejected by the API
- **Maximum 2,000 characters** — truncate if needed
- Answers go through **Trendyol moderation** before publishing
- Rejected answers can be resubmitted with corrections
- Do not include personal information, phone numbers, or external URLs

## Webhook Alternatives

Trendyol **does NOT offer webhooks for customer questions**. Webhooks are only available for order status changes. The only integration method for customer questions is **polling** via the filter endpoint.
