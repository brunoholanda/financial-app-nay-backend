import type { FindOptionsOrder } from 'typeorm';
import { SortOrder } from '../enums/sort-order.enum';

export type SortDirection = 'ASC' | 'DESC';

export interface ListSortInput {
  sortBy?: string;
  order?: SortOrder | SortDirection;
}

/**
 * Resolve TypeORM `order` from whitelist + optional query, falling back to defaults.
 * Nested paths like `category.name` are supported via FindOptionsOrder.
 */
export function resolveFindOrder<T extends object>(
  input: ListSortInput | undefined,
  allowed: readonly string[],
  defaults: FindOptionsOrder<T>,
): FindOptionsOrder<T> {
  const sortBy = input?.sortBy?.trim();
  const dir = normalizeDirection(input?.order);
  if (!sortBy || !allowed.includes(sortBy)) {
    return defaults;
  }
  return buildNestedOrder(sortBy, dir) as FindOptionsOrder<T>;
}

export function normalizeDirection(
  order?: SortOrder | SortDirection | string,
): SortDirection {
  if (!order) return 'ASC';
  const u = String(order).toUpperCase();
  return u === 'DESC' ? 'DESC' : 'ASC';
}

export function applyQueryBuilderOrder(
  qb: {
    orderBy: (sort: string, order?: 'ASC' | 'DESC') => unknown;
    addOrderBy: (sort: string, order?: 'ASC' | 'DESC') => unknown;
  },
  alias: string,
  input: ListSortInput | undefined,
  allowed: readonly string[],
  defaultField: string,
  defaultDir: SortDirection,
  fieldMap?: Record<string, string>,
): void {
  const sortBy = input?.sortBy?.trim();
  const dir = normalizeDirection(input?.order);
  if (sortBy && allowed.includes(sortBy)) {
    const col = fieldMap?.[sortBy] ?? `${alias}.${sortBy}`;
    qb.orderBy(col, dir);
    return;
  }
  const defCol = fieldMap?.[defaultField] ?? `${alias}.${defaultField}`;
  qb.orderBy(defCol, defaultDir);
}

function buildNestedOrder(
  path: string,
  dir: SortDirection,
): Record<string, unknown> {
  const parts = path.split('.');
  const root: Record<string, unknown> = {};
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (i === parts.length - 1) {
      cur[key] = dir;
    } else {
      const next: Record<string, unknown> = {};
      cur[key] = next;
      cur = next;
    }
  }
  return root;
}
