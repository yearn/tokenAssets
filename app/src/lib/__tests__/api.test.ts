import {afterEach, describe, expect, it, vi} from 'vitest';
import {API_BASE_URL, apiFetch} from '../api';

describe('api helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefixes requests with the expected base URL', async () => {
    const json = {ok: true};
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => json
    } as Response);

    const result = await apiFetch('/ping');

    expect(fetchSpy).toHaveBeenCalledWith(`${API_BASE_URL}/ping`, undefined);
    expect(result).toEqual(json);
  });

  it('throws when the response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'boom'
    } as Response);

    await expect(apiFetch('/ping')).rejects.toThrow('boom');
  });
});
