export default function StockLoading() {
  return (
    <main className="animate-pulse" aria-busy="true">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-10 md:px-6">
          <div className="h-3 w-16 rounded bg-secondary" />
          <div className="h-9 w-40 rounded bg-secondary" />
          <div className="h-4 w-56 rounded bg-secondary" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
        <div className="h-[360px] rounded-lg border bg-card" />
        <div className="h-64 rounded-lg border bg-card" />
      </div>
    </main>
  );
}
