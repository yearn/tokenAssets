import {afterEach, vi} from 'vitest';

afterEach(() => {
  sessionStorage?.clear?.();
  localStorage?.clear?.();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
