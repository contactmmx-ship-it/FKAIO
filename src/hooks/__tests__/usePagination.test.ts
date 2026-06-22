import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../usePagination';

describe('usePagination', () => {
  it('returns page 1 by default', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100 }));
    expect(result.current.currentPage).toBe(1);
  });

  it('calculates totalPages correctly', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100, pageSize: 20 }));
    expect(result.current.totalPages).toBe(5);
  });

  it('calculates totalPages with remainder', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 101, pageSize: 20 }));
    expect(result.current.totalPages).toBe(6);
  });

  it('returns totalPages of 1 for zero items', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 0 }));
    expect(result.current.totalPages).toBe(1);
  });

  it('returns totalPages of 1 for items less than pageSize', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 5, pageSize: 20 }));
    expect(result.current.totalPages).toBe(1);
  });

  it('goToPage clamps to valid range', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100, pageSize: 20 }));
    act(() => { result.current.goToPage(0); });
    expect(result.current.currentPage).toBe(1);
  });

  it('goToPage clamps upper bound', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100, pageSize: 20 }));
    act(() => { result.current.goToPage(10); });
    expect(result.current.currentPage).toBe(5);
  });

  it('setPage clamps to valid range', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100, pageSize: 20 }));
    act(() => { result.current.setPage(100); });
    expect(result.current.currentPage).toBe(5);
  });

  it('paginatedData returns correct slice for page 1', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 10, pageSize: 3 }));
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const page = result.current.paginatedData(data);
    expect(page).toEqual([1, 2, 3]);
  });

  it('paginatedData returns correct slice for page 2', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 10, pageSize: 3 }));
    act(() => { result.current.goToPage(2); });
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const page = result.current.paginatedData(data);
    expect(page).toEqual([4, 5, 6]);
  });

  it('startIndex and endIndex are correct for page 1', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100, pageSize: 20 }));
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(20);
  });

  it('startIndex and endIndex are correct for last page', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 95, pageSize: 20 }));
    act(() => { result.current.goToPage(5); });
    expect(result.current.startIndex).toBe(80);
    expect(result.current.endIndex).toBe(95);
  });

  it('nextPage increments page', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100, pageSize: 20 }));
    act(() => { result.current.nextPage(); });
    expect(result.current.currentPage).toBe(2);
  });

  it('nextPage does not exceed totalPages', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 40, pageSize: 20 }));
    act(() => { result.current.goToPage(2); });
    act(() => { result.current.nextPage(); });
    expect(result.current.currentPage).toBe(2);
  });

  it('prevPage decrements page', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100, pageSize: 20 }));
    act(() => { result.current.goToPage(3); });
    act(() => { result.current.prevPage(); });
    expect(result.current.currentPage).toBe(2);
  });

  it('prevPage does not go below 1', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100, pageSize: 20 }));
    act(() => { result.current.prevPage(); });
    expect(result.current.currentPage).toBe(1);
  });
});
