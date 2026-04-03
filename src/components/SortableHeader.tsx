import { useCallback, useMemo, useState } from "react";
import { FontAwesomeIcon, faArrowDown, faArrowUp } from "./Icon";

export type SortDirection = "asc" | "desc";

export type SortState<K extends string> = {
  key: K;
  direction: SortDirection;
} | null;

export function useSortableTable<K extends string>(
  defaultSort: SortState<K> = null,
) {
  const [sort, setSort] = useState<SortState<K>>(defaultSort);

  const toggle = useCallback((key: K) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null; // third click clears
      }
      return { key, direction: "asc" };
    });
  }, []);

  return { sort, toggle };
}

/** Sort an array client-side given a sort state and a map of comparators. */
export function useSorted<T, K extends string>(
  items: T[],
  sort: SortState<K>,
  comparators: Partial<Record<K, (a: T, b: T) => number>>,
): T[] {
  return useMemo(() => {
    if (!sort) return items;
    const cmp = comparators[sort.key];
    if (!cmp) return items;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...items].sort((a, b) => dir * cmp(a, b));
  }, [items, sort, comparators]);
}

type SortableHeaderProps<K extends string> = {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onToggle: (key: K) => void;
};

export function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  onToggle,
}: SortableHeaderProps<K>) {
  const active = sort?.key === sortKey;
  return (
    <th>
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 font-semibold text-xs uppercase hover:text-base-content"
        onClick={() => onToggle(sortKey)}
      >
        {label}
        {active && (
          <FontAwesomeIcon
            icon={sort.direction === "asc" ? faArrowUp : faArrowDown}
            className="text-[0.6rem]"
            aria-hidden="true"
          />
        )}
      </button>
    </th>
  );
}
