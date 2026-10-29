export default function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl">{title}</h1>
      <div className="card mt-4 text-navy/70">Coming soon.</div>
    </div>
  )
}
