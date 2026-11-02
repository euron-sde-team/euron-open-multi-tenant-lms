export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header skeleton */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container-custom flex h-14 items-center gap-4">
          <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          <nav className="hidden flex-1 items-center gap-6 md:flex">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </nav>
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      </header>

      {/* Hero block skeleton */}
      <section className="section-padding border-b border-border/40">
        <div className="container-custom flex flex-col items-center gap-6 text-center">
          <div className="h-10 w-3/4 max-w-xl animate-pulse rounded bg-muted" />
          <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-muted" />
          <div className="h-5 w-2/3 max-w-xl animate-pulse rounded bg-muted" />
          <div className="mt-2 flex gap-3">
            <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </section>

      {/* Content blocks skeleton */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="grid gap-8 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-lg border border-border/40 p-6"
              >
                <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding border-t border-border/40">
        <div className="container-custom flex flex-col items-center gap-4">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
        </div>
      </section>

      {/* Footer skeleton */}
      <footer className="mt-auto border-t border-border/40 py-8">
        <div className="container-custom">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="flex gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 w-16 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
