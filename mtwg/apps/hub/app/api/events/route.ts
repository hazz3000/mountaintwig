import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/supabase'

const EventSchema = z.object({
  event:       z.string().min(1).max(64),
  game_id:     z.string().min(1).max(64),
  platform:    z.enum(['ios', 'android', 'web']).optional(),
  sdk_version: z.string().optional(),
  props:       z.record(z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = EventSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { event, game_id, platform, sdk_version, props } = body.data

  // ── Log to console in dev (replace with ClickHouse/BigQuery in Phase 3) ────
  if (process.env.NODE_ENV === 'development') {
    console.log(`[event] ${user.id} | ${game_id} | ${event}`, props ?? '')
  }

  // ── Forward to Amplitude server-side (optional — SDK also fires client-side)─
  // Useful for events that need guaranteed delivery (not browser-dependent)
  const amplitudeKey = process.env.AMPLITUDE_SERVER_KEY
  if (amplitudeKey) {
    fetch('https://api2.amplitude.com/2/httpapi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: amplitudeKey,
        events: [{
          user_id:         user.id,
          event_type:      event,
          event_properties: {
            game_id,
            platform: platform ?? 'web',
            sdk_version: sdk_version ?? 'unknown',
            ...props,
          },
          time: Date.now(),
        }],
      }),
    }).catch(() => {}) // non-blocking, non-critical
  }

  return NextResponse.json({ ok: true })
}
