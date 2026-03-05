import { describe, it, expect } from 'vitest';

/**
 * Test the content script i18n logic in isolation.
 * We replicate the ct() function and _csStrings map to verify translations.
 */

const _csStrings: Record<string, [string, string]> = {
  'rescue.text':       ['{n} 个来源导入失败，可尝试抢救', '{n} failed source imports — try rescue'],
  'rescue.btn':        ['↻ 抢救', '↻ Rescue'],
  'rescue.pending':    ['待抢救', 'Pending'],
  'rescue.running':    ['抢救中...', 'Rescuing...'],
  'rescue.done':       ['抢救完成：<strong>{s}</strong> 成功', 'Rescue done: <strong>{s}</strong> succeeded'],
  'rescue.doneFail':   ['，<strong>{f}</strong> 失败', ', <strong>{f}</strong> failed'],
  'rescue.removeFailed': ['移除已抢救的失败来源', 'Remove rescued failed sources'],
  'repair.text':       ['{n} 个来源需要修复（内容可能为空）', '{n} sources need repair (may be empty)'],
  'repair.btn':        ['🔧 修复', '🔧 Repair'],
  'repair.pending':    ['待修复', 'Pending'],
  'repair.running':    ['修复中...', 'Repairing...'],
  'repair.done':       ['修复完成：<strong>{s}</strong> 成功', 'Repair done: <strong>{s}</strong> succeeded'],
  'repair.doneFail':   ['，<strong>{f}</strong> 失败', ', <strong>{f}</strong> failed'],
  'repair.removeOld':  ['移除原始失败来源', 'Remove original failed sources'],
  'success':           ['成功', 'Success'],
  'failed':            ['失败', 'Failed'],
  'done':              ['✓ 完成', '✓ Done'],
  'close':             ['关闭', 'Close'],
};

function ct(isZh: boolean, key: string, params?: Record<string, string | number>): string {
  const pair = _csStrings[key];
  let text = pair ? pair[isZh ? 0 : 1] : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

describe('Content script i18n (ct)', () => {
  it('returns Chinese for zh locale', () => {
    expect(ct(true, 'rescue.btn')).toBe('↻ 抢救');
    expect(ct(true, 'repair.btn')).toBe('🔧 修复');
    expect(ct(true, 'close')).toBe('关闭');
    expect(ct(true, 'done')).toBe('✓ 完成');
  });

  it('returns English for en locale', () => {
    expect(ct(false, 'rescue.btn')).toBe('↻ Rescue');
    expect(ct(false, 'repair.btn')).toBe('🔧 Repair');
    expect(ct(false, 'close')).toBe('Close');
    expect(ct(false, 'done')).toBe('✓ Done');
  });

  it('substitutes params correctly (zh)', () => {
    expect(ct(true, 'rescue.text', { n: 3 })).toBe('3 个来源导入失败，可尝试抢救');
    expect(ct(true, 'rescue.done', { s: 2 })).toBe('抢救完成：<strong>2</strong> 成功');
    expect(ct(true, 'rescue.doneFail', { f: 1 })).toBe('，<strong>1</strong> 失败');
  });

  it('substitutes params correctly (en)', () => {
    expect(ct(false, 'rescue.text', { n: 3 })).toBe('3 failed source imports — try rescue');
    expect(ct(false, 'rescue.done', { s: 2 })).toBe('Rescue done: <strong>2</strong> succeeded');
    expect(ct(false, 'rescue.doneFail', { f: 1 })).toBe(', <strong>1</strong> failed');
  });

  it('supports HTML in params (for <strong> count)', () => {
    const result = ct(false, 'rescue.text', { n: '<strong>5</strong>' });
    expect(result).toBe('<strong>5</strong> failed source imports — try rescue');
  });

  it('returns key for unknown key', () => {
    expect(ct(true, 'nonexistent.key')).toBe('nonexistent.key');
    expect(ct(false, 'nonexistent.key')).toBe('nonexistent.key');
  });

  it('every key has both zh and en translations', () => {
    for (const [key, [zh, en]] of Object.entries(_csStrings)) {
      expect(zh, `${key} zh is empty`).toBeTruthy();
      expect(en, `${key} en is empty`).toBeTruthy();
    }
  });

  it('repair translations work for both locales', () => {
    expect(ct(true, 'repair.text', { n: 2 })).toBe('2 个来源需要修复（内容可能为空）');
    expect(ct(false, 'repair.text', { n: 2 })).toBe('2 sources need repair (may be empty)');
    expect(ct(true, 'repair.running')).toBe('修复中...');
    expect(ct(false, 'repair.running')).toBe('Repairing...');
  });
});
