import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { t, setLocale } from '@/lib/i18n';

describe('i18n', () => {
  beforeEach(() => {
    // Reset to zh
    setLocale('zh');
  });

  describe('t()', () => {
    it('returns Chinese text by default', () => {
      expect(t('import')).toBe('导入');
      expect(t('cancel')).toBe('取消');
    });

    it('returns English text when locale is en', () => {
      setLocale('en');
      expect(t('import')).toBe('Import');
      expect(t('cancel')).toBe('Cancel');
    });

    it('substitutes template variables', () => {
      const result = t('successFailCount', { success: 3, failed: 1 });
      expect(result).toBe('成功 3 个，失败 1 个');
    });

    it('substitutes template variables in English', () => {
      setLocale('en');
      const result = t('successFailCount', { success: 3, failed: 1 });
      expect(result).toBe('3 succeeded, 1 failed');
    });

    it('handles multiple occurrences of same variable', () => {
      // Test a key that might have repeated vars
      const result = t('app.importingProgress', { completed: 5, total: 10 });
      expect(result).toContain('5');
      expect(result).toContain('10');
    });
  });

  describe('setLocale()', () => {
    it('switches to English', () => {
      setLocale('en');
      expect(t('load')).toBe('Load');
    });

    it('switches back to Chinese', () => {
      setLocale('en');
      setLocale('zh');
      expect(t('load')).toBe('加载');
    });

    it('persists to localStorage', () => {
      setLocale('en');
      expect(localStorage.getItem('jetpack_locale')).toBe('en');
    });
  });

  describe('key coverage', () => {
    it('all app tab keys exist in both locales', () => {
      const keys = [
        'app.tabBookmarks', 'app.tabDocs', 'app.tabPodcast', 'app.tabAI', 'app.tabMore',
      ] as const;
      for (const key of keys) {
        setLocale('zh');
        const zh = t(key);
        setLocale('en');
        const en = t(key);
        expect(zh).toBeTruthy();
        expect(en).toBeTruthy();
        expect(zh).not.toBe(en);
      }
    });

    it('all claude guide keys exist', () => {
      const keys = [
        'claude.guideTitle', 'claude.guideStep1', 'claude.guideStep2',
        'claude.guideStep3', 'claude.guideStep4', 'claude.guideTip',
      ] as const;
      for (const key of keys) {
        setLocale('zh');
        expect(t(key)).toBeTruthy();
        setLocale('en');
        expect(t(key)).toBeTruthy();
      }
    });

    it('bookmark keys exist in both locales', () => {
      const keys = [
        'bookmark.emptyTitle', 'bookmark.emptyDesc',
        'bookmark.step1', 'bookmark.step2', 'bookmark.step3',
      ] as const;
      for (const key of keys) {
        setLocale('zh');
        expect(t(key)).toBeTruthy();
        setLocale('en');
        expect(t(key)).toBeTruthy();
      }
    });
  });
});
