/**
 * Supabase returns at most 1000 rows per request and cuts the rest off without
 * a word. Reports that count "everything" must read page by page, or their
 * numbers quietly go wrong once the table outgrows one page.
 *
 * `page` must apply a stable order (end it with `.order("id")`) and `.range(from, to)`.
 * Throws when any page fails - a partial result is never returned.
 */
const PAGE_SIZE = 1000;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data as T[] | null) ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/** `ilike` treats % and _ as wildcards - escape them to match an email exactly. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
