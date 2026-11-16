import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const allowedTypes = new Set(['Support', 'Shoutout', 'Question', 'Song request'])
const blockedWords = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot']
const reservedUsernames = new Set(['admin', 'api', 'dashboard', 'demo', 'login', 'overlay', 'privacy', 'refunds', 'signup', 'terms'])

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function getFingerprint(request: Request) {
  const address = request.headers.get('x-real-ip')
    ?? request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
  if (!address) throw new Error('Client network address is unavailable')
  return address
}

async function hashFingerprint(address: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(address))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const rateLimitSecret = Deno.env.get('RATE_LIMIT_SECRET')
  if (!supabaseUrl || !serviceRoleKey || !rateLimitSecret) {
    console.error('Support submission requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and RATE_LIMIT_SECRET')
    return respond(503, { error: 'Support submission is not configured yet.' })
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return respond(400, { error: 'Request must contain valid JSON.' })
  }

  const creatorUsername = typeof payload.creator_username === 'string' ? payload.creator_username.trim().toLowerCase() : ''
  const rawName = typeof payload.fan_name === 'string' ? payload.fan_name.trim() : ''
  const anonymous = payload.is_anonymous === true
  const message = typeof payload.message === 'string' ? payload.message.trim() : ''
  const amount = Number(payload.amount)
  const requestType = typeof payload.request_type === 'string' ? payload.request_type : 'Support'
  if (!/^[a-z0-9_]{3,20}$/.test(creatorUsername) || reservedUsernames.has(creatorUsername)) return respond(400, { error: 'Creator username is invalid.' })
  if (!anonymous && (rawName.length < 2 || rawName.length > 40)) return respond(400, { error: 'Name must be 2–40 characters, or choose anonymous.' })
  if (message.length > 240 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(message)) return respond(400, { error: 'Message must be at most 240 characters.' })
  if (!message) return respond(400, { error: 'Write a little message before sending your support.' })
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) return respond(400, { error: 'Choose an amount between ₹1 and ₹1,00,000.' })
  if (!allowedTypes.has(requestType)) return respond(400, { error: 'Request type is invalid.' })
  if (blockedWords.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(message))) return respond(400, { error: 'Please keep your message kind and respectful.' })

  let fingerprint: string
  try {
    fingerprint = await hashFingerprint(getFingerprint(request), rateLimitSecret)
  } catch (error) {
    console.error('Could not establish a support rate-limit fingerprint', error)
    return respond(503, { error: 'Support submission is temporarily unavailable.' })
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: allowed, error: rateLimitError } = await service.rpc('check_support_rate_limit', { p_fingerprint: fingerprint })
  if (rateLimitError) {
    console.error('Support rate-limit check failed', rateLimitError)
    return respond(503, { error: 'Support submission is temporarily unavailable.' })
  }
  if (!allowed) return respond(429, { error: 'Too many messages from this connection. Please try again in a minute.' })

  const { data: profile, error: profileError } = await service.from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('username', creatorUsername)
    .eq('status', 'active')
    .maybeSingle()
  if (profileError) {
    console.error('Could not resolve support recipient', profileError)
    return respond(503, { error: 'Support submission is temporarily unavailable.' })
  }
  if (!profile) return respond(404, { error: 'This creator is not accepting support right now.' })

  const { data: support, error: insertError } = await service.from('supports').insert({
    creator_username: creatorUsername,
    fan_name: anonymous ? 'Anonymous' : rawName,
    is_anonymous: anonymous,
    message,
    amount,
    request_type: requestType,
    payment_status: 'mock',
    status: 'new',
  }).select('id, creator_username, fan_name, is_anonymous, message, amount, request_type, status, payment_status, created_at')
    .single()
  if (insertError) {
    console.error('Could not save mock support', insertError)
    return respond(503, { error: 'Could not save your support. Please try again.' })
  }

  const { data: privateSettings, error: settingsError } = await service.from('creator_private_settings')
    .select('overlay_token')
    .eq('creator_id', profile.id)
    .maybeSingle()
  if (settingsError) console.error('Could not load the creator overlay channel', settingsError)
  if (privateSettings?.overlay_token) {
    const channel = service.channel(`superdrop:${privateSettings.overlay_token}`)
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Overlay broadcast subscription timed out')), 5000)
        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer)
            resolve()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            clearTimeout(timer)
            reject(new Error(`Overlay channel subscription failed: ${status}`))
          }
        })
      })
      const { error: broadcastError } = await channel.send({
        type: 'broadcast',
        event: 'support',
        payload: {
          creator_name: profile.display_name,
          avatar_url: profile.avatar_url,
          fan_name: support.fan_name,
          is_anonymous: support.is_anonymous,
          amount: support.amount,
          message: support.message,
          request_type: support.request_type,
          created_at: support.created_at,
        },
      })
      if (broadcastError) throw broadcastError
    } catch (error) {
      console.error('Support was saved, but the live overlay broadcast failed', error)
    } finally {
      await service.removeChannel(channel)
    }
  }

  return respond(201, { support })
})
