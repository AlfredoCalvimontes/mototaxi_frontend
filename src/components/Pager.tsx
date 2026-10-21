export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const button =
    'rounded border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <button
        type="button"
        aria-label="Anterior"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={button}
      >
        ‹
      </button>
      <span className="text-slate-600">
        {page} / {pages}
      </span>
      <button
        type="button"
        aria-label="Siguiente"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className={button}
      >
        ›
      </button>
    </div>
  );
}
