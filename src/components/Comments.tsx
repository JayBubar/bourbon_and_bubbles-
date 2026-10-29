import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/dates'

export type EntityType = 'company' | 'idea' | 'task' | 'ticket' | 'auction_item'

interface Comment {
  id: string
  parent_id: string | null
  body: string
  created_at: string
  author_id: string | null
  author: { name: string } | null
}

/** Short threaded notes on any record. Replies are one level deep. */
export default function Comments({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { me, isAdmin } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [replyTo, setReplyTo] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('comments')
      .select('id, parent_id, body, created_at, author_id, author:allowed_users(name)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at')
    setComments((data as unknown as Comment[]) ?? [])
  }, [entityType, entityId])

  useEffect(() => {
    load()
  }, [load])

  async function post(body: string, parentId: string | null) {
    const { error } = await supabase
      .from('comments')
      .insert({ entity_type: entityType, entity_id: entityId, body, parent_id: parentId })
    if (!error) {
      setReplyTo(null)
      load()
    }
    return !error
  }

  async function remove(id: string) {
    if (!confirm('Delete this note?')) return
    await supabase.from('comments').delete().eq('id', id)
    load()
  }

  const roots = comments.filter((c) => !c.parent_id)
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id)

  function Item({ c }: { c: Comment }) {
    return (
      <div className="text-sm">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-navy">{c.author?.name ?? 'Former user'}</span>
          <span className="text-xs text-navy/50">{formatDateTime(c.created_at)}</span>
        </div>
        <p className="whitespace-pre-wrap text-ink">{c.body}</p>
        <div className="flex gap-3 text-xs">
          {!c.parent_id && (
            <button className="py-1 text-burgundy" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
              Reply
            </button>
          )}
          {(c.author_id === me?.id || isAdmin) && (
            <button className="py-1 text-navy/50" onClick={() => remove(c.id)}>
              Delete
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base">Notes</h3>
      {roots.length === 0 && <p className="text-sm text-navy/50">No notes yet.</p>}
      {roots.map((c) => (
        <div key={c.id} className="space-y-2">
          <Item c={c} />
          {(repliesOf(c.id).length > 0 || replyTo === c.id) && (
            <div className="ml-4 space-y-2 border-l-2 border-gold/40 pl-3">
              {repliesOf(c.id).map((r) => (
                <Item key={r.id} c={r} />
              ))}
              {replyTo === c.id && <NoteForm placeholder="Reply…" autoFocus onSubmit={(b) => post(b, c.id)} />}
            </div>
          )}
        </div>
      ))}
      <NoteForm placeholder="Add a note…" onSubmit={(b) => post(b, null)} />
    </section>
  )
}

function NoteForm({
  placeholder,
  autoFocus,
  onSubmit,
}: {
  placeholder: string
  autoFocus?: boolean
  onSubmit: (body: string) => Promise<boolean>
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    if (await onSubmit(body.trim())) setBody('')
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input className="input" placeholder={placeholder} value={body} autoFocus={autoFocus} onChange={(e) => setBody(e.target.value)} />
      <button className="btn btn-primary shrink-0" disabled={busy || !body.trim()}>
        Post
      </button>
    </form>
  )
}
