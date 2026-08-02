export default function PocLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-7 sm:px-6 md:pb-12">
      <div className="animate-pulse">
        <div className="h-7 w-44 rounded bg-muted" />
        <div className="mt-2 h-4 w-full max-w-md rounded bg-muted" />
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-32 rounded-lg border border-border bg-surface"
            />
          ))}
        </div>
        <div className="mt-6 h-56 rounded-lg border border-border bg-surface" />
      </div>
    </main>
  );
}
