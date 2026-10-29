import type { Config } from '@netlify/functions'
import { sendTestDigest, serviceClient } from '../lib/reminders.mts'

// Admin-only manual trigger: emails the signed-in admin their own digest right now.
export default async (req: Request) => {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const db = serviceClient()
    const { data: auth, error } = await db.auth.getUser(token)
    if (error || !auth.user?.email) return Response.json({ error: 'Not signed in' }, { status: 401 })

    const { data: me } = await db.from('allowed_users').select('id, role').eq('email', auth.user.email.toLowerCase()).maybeSingle()
    if (me?.role !== 'admin') return Response.json({ error: 'Admins only' }, { status: 403 })

    const result = await sendTestDigest(me.id, new URL(req.url).origin)
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/reminder-test',
  method: 'POST',
}
