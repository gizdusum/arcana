import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VPS_API_URL = process.env.NEXT_PUBLIC_HERMES_API_URL || 'http://localhost:3001'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        const resp = await fetch(`${VPS_API_URL}/api/advisor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!resp.ok || !resp.body) {
          send({ type: 'error', message: `VPS error ${resp.status}` })
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        // Stream VPS response directly to client
        const reader = resp.body.getReader()
        const dec = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(encoder.encode(dec.decode(value, { stream: true })))
        }
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Connection error' })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
