import { useEffect, type ReactNode } from 'react'

/** Bottom sheet on phones, centered dialog on larger screens. */
export default function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy/50" onClick={onClose} />
      <div
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-cream shadow-xl md:max-w-xl md:rounded-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-2 border-b border-gold/30 px-4 py-3">
          <h2 className="flex-1 truncate text-lg">{title}</h2>
          <button onClick={onClose} className="btn -mr-2 px-3 text-2xl leading-none text-navy/60" aria-label="Close">
            ×
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  )
}
