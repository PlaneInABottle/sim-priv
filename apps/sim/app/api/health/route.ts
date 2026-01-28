/**
 * Health check endpoint for deployment platforms (Render, Docker, K8s)
 */

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
}
