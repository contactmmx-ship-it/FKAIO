import { useState, useMemo, useCallback } from 'react';

interface UsePaginationOptions {
  totalItems: number;
  pageSize?: number;
}

interface UsePaginationReturn {
  currentPage: number;
  totalPages: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  paginatedData: <T>(data: T[]) => T[];
  setPage: (page: number) => void;
  startIndex: number;
  endIndex: number;
}

export function usePagination({
  totalItems,
  pageSize = 20,
}: UsePaginationOptions): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize]
  );

  // Clamp currentPage to valid range when totalItems changes
  const safePage = Math.min(currentPage, totalPages);

  const nextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 1));
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages]
  );

  const setPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages]
  );

  const paginatedData = useCallback(
    <T,>(data: T[]): T[] => {
      const start = (safePage - 1) * pageSize;
      return data.slice(start, start + pageSize);
    },
    [safePage, pageSize]
  );

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    currentPage: safePage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    paginatedData,
    setPage,
    startIndex,
    endIndex,
  };
}