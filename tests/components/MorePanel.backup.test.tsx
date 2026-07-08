import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { resetStorage, storageMock } from '../setup';
import { setLocale } from '@/lib/i18n';
import { MorePanel } from '@/components/MorePanel';

// jsdom implements neither URL.createObjectURL nor a real download; stub them so
// the export handler's blob→anchor wiring can be exercised without a browser.
beforeEach(() => {
  resetStorage();
  setLocale('en');
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

describe('MorePanel — data backup UI (issue #47)', () => {
  it('renders the backup section with export/import controls', () => {
    render(<MorePanel onProgress={vi.fn()} />);
    expect(screen.getByText('Backup & migrate data')).toBeTruthy();
    expect(screen.getByText('Export data')).toBeTruthy();
    expect(screen.getByText('Import data')).toBeTruthy();
  });

  it('shows the overwrite warning only when overwrite mode is selected', () => {
    render(<MorePanel onProgress={vi.fn()} />);
    // Default is merge → no warning.
    expect(screen.queryByText(/Overwrite will replace/)).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Overwrite' }));
    expect(screen.getByText(/Overwrite will replace/)).toBeTruthy();
  });

  it('export click builds a downloadable blob and reports success', async () => {
    storageMock['jetpackSettings'] = { autoRenamePastedSources: true };
    render(<MorePanel onProgress={vi.fn()} />);
    fireEvent.click(screen.getByText('Export data'));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Data exported')).toBeTruthy();
  });

  it('overwrite import requires explicit confirmation before touching storage', async () => {
    storageMock['nlm_bookmarks'] = { items: [{ id: 'x', url: 'u', title: 'X', collection: 'c', addedAt: 1 }], collections: ['c'] };
    const { container } = render(<MorePanel onProgress={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Overwrite' }));

    const file = new File(
      [JSON.stringify({ schemaVersion: 1, data: { nlm_bookmarks: { items: [], collections: ['New'] } } })],
      'backup.json',
      { type: 'application/json' },
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    // Confirm gate shows; existing data is untouched until the user confirms.
    expect(await screen.findByText('Confirm overwrite')).toBeTruthy();
    expect((storageMock['nlm_bookmarks'] as { items: unknown[] }).items).toHaveLength(1);

    fireEvent.click(screen.getByText('Confirm overwrite'));
    await waitFor(() =>
      expect((storageMock['nlm_bookmarks'] as { collections: string[] }).collections).toEqual(['New']),
    );
  });

  it('a corrupt backup file is rejected, not applied', async () => {
    storageMock['nlm_bookmarks'] = { items: [{ id: 'x', url: 'u', title: 'X', collection: 'c', addedAt: 1 }], collections: ['c'] };
    const { container } = render(<MorePanel onProgress={vi.fn()} />);
    const file = new File(['{ not valid json'], 'bad.json', { type: 'application/json' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText(/Import failed/)).toBeTruthy();
    expect((storageMock['nlm_bookmarks'] as { items: unknown[] }).items).toHaveLength(1); // untouched
  });
});
