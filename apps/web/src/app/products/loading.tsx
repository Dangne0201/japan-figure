export default function ProductsLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-shell min-h-screen animate-pulse py-12"
      aria-busy="true"
      aria-label="Đang tải danh mục"
    >
      <div className="h-9 w-56 rounded bg-brand-plum/10" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="aspect-[4/5] rounded-3xl bg-brand-plum/10" />
        ))}
      </div>
      <p className="sr-only" role="status">
        Đang tải sản phẩm...
      </p>
    </main>
  );
}
