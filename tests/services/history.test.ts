import { describe, it, expect, beforeEach } from 'vitest';
import { getHistory, addToHistory, clearHistory } from '@/services/history';
import { resetStorage } from '../setup';

describe('history service', () => {
  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
  });

  it('returns empty array when no history', async () => {
    const history = await getHistory();
    expect(history).toEqual([]);
  });

  it('adds item to history', async () => {
    await addToHistory('https://example.com', 'success', 'Example');
    const history = await getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].url).toBe('https://example.com');
    expect(history[0].title).toBe('Example');
    expect(history[0].status).toBe('success');
    expect(history[0].id).toBeDefined();
    expect(history[0].importedAt).toBeGreaterThan(0);
  });

  it('adds error item with error message', async () => {
    await addToHistory('https://example.com', 'error', undefined, 'Network error');
    const history = await getHistory();
    expect(history[0].status).toBe('error');
    expect(history[0].error).toBe('Network error');
  });

  it('prepends new items (newest first)', async () => {
    await addToHistory('https://first.com', 'success');
    await addToHistory('https://second.com', 'success');
    const history = await getHistory();
    expect(history[0].url).toBe('https://second.com');
    expect(history[1].url).toBe('https://first.com');
  });

  it('respects limit parameter', async () => {
    await addToHistory('https://1.com', 'success');
    await addToHistory('https://2.com', 'success');
    await addToHistory('https://3.com', 'success');
    const history = await getHistory(2);
    expect(history).toHaveLength(2);
  });

  it('truncates at 100 items', async () => {
    for (let i = 0; i < 105; i++) {
      await addToHistory(`https://example.com/${i}`, 'success');
    }
    const history = await getHistory();
    expect(history.length).toBeLessThanOrEqual(100);
  });

  it('clears all history', async () => {
    await addToHistory('https://example.com', 'success');
    await clearHistory();
    const history = await getHistory();
    expect(history).toEqual([]);
  });
});
