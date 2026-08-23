export default function CategoryLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-[#f7f1e7] pb-20">
      <div className="h-28 bg-white" />
      <section className="bg-[#132238]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-2">
          <div className="space-y-4 py-6">
            <div className="h-3 w-24 rounded bg-white/20" />
            <div className="h-12 w-72 max-w-full rounded bg-white/20" />
            <div className="h-4 w-52 rounded bg-white/20" />
          </div>
          <div className="min-h-48 rounded-md bg-white/15 sm:min-h-64" />
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 h-24 rounded-md bg-white" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-md bg-white">
              <div className="aspect-[3/4] bg-stone-200" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-24 rounded bg-stone-200" />
                <div className="h-4 w-full rounded bg-stone-200" />
                <div className="h-4 w-20 rounded bg-stone-200" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
