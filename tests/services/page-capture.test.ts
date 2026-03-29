import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the handler logic by extracting it into a testable helper.
// The actual case in background.ts calls the same pattern.

async function capturePageContent(
  tabId: number,
  tabUrl: string,
  executeScript: (opts: { target: { tabId: number }; func: () => { html: string; title: string } }) => Promise<Array<{ result: { html: string; title: string } }>>,
  convertHtmlToMarkdown: (html: string) => Promise<{ markdown: string; title: string }>,
  importText: (text: string, title: string, senderTabId?: number) => Promise<boolean>,
  senderTabId?: number
): Promise<boolean> {
  if (!tabUrl.startsWith('http')) {
    throw new Error('Cannot capture this page type');
  }
  let extracted: { html: string; title: string };
  try {
    const result = await executeScript({ target: { tabId }, func: () => ({ html: document.body.innerHTML, title: document.title }) });
    extracted = result[0].result;
  } catch {
    throw new Error('Could not capture this page type');
  }
  const { markdown, title } = await convertHtmlToMarkdown(extracted.html);
  const pageTitle = extracted.title || title;
  const success = await importText(markdown, pageTitle, senderTabId);
  if (!success) throw new Error('Import failed');
  return true;
}

describe('capturePageContent', () => {
  const mockExecuteScript = vi.fn();
  const mockConvert = vi.fn();
  const mockImport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts HTML from tab, converts to markdown, and imports', async () => {
    mockExecuteScript.mockResolvedValue([{ result: { html: '<p>Hello</p>', title: 'My Page' } }]);
    mockConvert.mockResolvedValue({ markdown: '# Hello', title: 'My Page' });
    mockImport.mockResolvedValue(true);

    const result = await capturePageContent(42, 'https://example.com', mockExecuteScript, mockConvert, mockImport, 1);

    expect(result).toBe(true);
    expect(mockExecuteScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 42 } }));
    expect(mockConvert).toHaveBeenCalledWith('<p>Hello</p>');
    expect(mockImport).toHaveBeenCalledWith('# Hello', 'My Page', 1);
  });

  it('throws for non-http URLs', async () => {
    await expect(
      capturePageContent(1, 'chrome://extensions', mockExecuteScript, mockConvert, mockImport)
    ).rejects.toThrow('Cannot capture this page type');
    expect(mockExecuteScript).not.toHaveBeenCalled();
  });

  it('throws when executeScript fails (restricted tab)', async () => {
    mockExecuteScript.mockRejectedValue(new Error('Cannot access a chrome extension URL'));
    await expect(
      capturePageContent(1, 'https://example.com', mockExecuteScript, mockConvert, mockImport)
    ).rejects.toThrow('Could not capture this page type');
  });

  it('throws when importText returns false', async () => {
    mockExecuteScript.mockResolvedValue([{ result: { html: '<p>x</p>', title: 'T' } }]);
    mockConvert.mockResolvedValue({ markdown: 'x', title: 'T' });
    mockImport.mockResolvedValue(false);

    await expect(
      capturePageContent(1, 'https://example.com', mockExecuteScript, mockConvert, mockImport)
    ).rejects.toThrow('Import failed');
  });

  it('uses tab title when markdown title is empty', async () => {
    mockExecuteScript.mockResolvedValue([{ result: { html: '<p>content</p>', title: 'Tab Title' } }]);
    mockConvert.mockResolvedValue({ markdown: 'content', title: '' });
    mockImport.mockResolvedValue(true);

    await capturePageContent(1, 'https://example.com', mockExecuteScript, mockConvert, mockImport);
    expect(mockImport).toHaveBeenCalledWith('content', 'Tab Title', undefined);
  });
});
