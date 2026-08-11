export type PageMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export function toPageMeta(p: {
  total: number;
  page: number;
  limit: number;
}): PageMeta {
  const perPage = Math.max(p.limit, 1);
  const totalPages = Math.max(1, Math.ceil(p.total / perPage));
  return {
    page: p.page,
    perPage,
    total: p.total,
    totalPages,
  };
}

export function buildListQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

export function unwrapPage<T>(res: unknown): Paginated<T> {
  if (Array.isArray(res)) {
    return { items: res as T[], total: res.length, page: 1, limit: Math.max(res.length, 1) };
  }
  const r = res as Partial<Paginated<T>> & { take?: number; skip?: number };
  const items = r.items ?? [];
  const limit = r.limit ?? r.take ?? 50;
  const page =
    r.page ??
    (typeof r.skip === "number" && limit > 0
      ? Math.floor(r.skip / limit) + 1
      : 1);
  return {
    items,
    total: typeof r.total === "number" ? r.total : items.length,
    page,
    limit,
  };
}
