// Content script for NotebookLM page automation
// Updated: 2026-02-22 — adapted to new NotebookLM UI

export default defineContentScript({
  matches: ['https://notebooklm.google.com/*'],
  runAt: 'document_idle',

  main() {
    // Prevent duplicate listener registration from multiple injections
    if ((window as unknown as Record<string, boolean>).__NLM_IMPORTER_LOADED__) return;
    (window as unknown as Record<string, boolean>).__NLM_IMPORTER_LOADED__ = true;

    console.log('NotebookLM Importer content script loaded');

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'IMPORT_URL') {
        importUrlToNotebookLM(message.url)
          .then((success) => sendResponse({ success }))
          .catch((error) => {
            console.error('Import error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;
      }

      if (message.type === 'IMPORT_TEXT') {
        importTextToNotebookLM(message.text, message.title)
          .then((success) => sendResponse({ success }))
          .catch((error) => {
            console.error('Import text error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;
      }

      if (message.type === 'GET_FAILED_SOURCES') {
        const failedUrls = getFailedSourceUrls();
        sendResponse({ success: true, data: failedUrls });
        return true;
      }

      if (message.type === 'RESCUE_SOURCE_DONE') {
        // Update inline banner after rescue completes
        updateInlineBanner(message.results);
        sendResponse({ success: true });
        return true;
      }
    });

    // Auto-inject rescue banner if failed sources detected
    setTimeout(() => injectRescueBanner(), 2000);

    // Re-check periodically (sources may load late)
    const observer = new MutationObserver(() => {
      if (!document.getElementById('nlm-rescue-banner')) {
        injectRescueBanner();
      }
    });
    const scrollArea = document.querySelector('.scroll-area-desktop');
    if (scrollArea) {
      observer.observe(scrollArea, { childList: true });
    }
  },
});

// ─── URL Import ─────────────────────────────────────────────

async function importUrlToNotebookLM(url: string): Promise<boolean> {
  try {
    // Step 1: Open the add source dialog
    await openAddSourceDialog();

    // Step 2: Check if we're already on the URL input step (dialog may already be at website sub-page)
    let urlTextarea = await findTextareaByPlaceholder(
      ['粘贴任何链接', '粘贴', 'Paste any link', 'Paste'],
      500
    );

    if (!urlTextarea) {
      // Not at URL input step yet — click "网站" (Website) button
      const websiteButton = await findButtonByText(['网站', 'Website', 'Link'], 3000);
      if (!websiteButton) {
        throw new Error('Website button not found in dialog');
      }
      websiteButton.click();
      await delay(500);

      // Now find the URL textarea
      urlTextarea = await findTextareaByPlaceholder(
        ['粘贴任何链接', '粘贴', 'Paste any link', 'Paste'],
        3000
      );
    }
    if (!urlTextarea) {
      throw new Error('URL input textarea not found');
    }

    // Fill the URL
    await fillInput(urlTextarea, url);

    // Step 4: Click "插入" (Insert) button
    const insertButton = await findButtonByText(['插入', 'Insert'], 3000);
    if (!insertButton) {
      throw new Error('Insert button not found');
    }
    insertButton.click();

    await delay(1500);
    return true;
  } catch (error) {
    console.error('Failed to import URL:', error);
    return false;
  }
}

// ─── Text Import ────────────────────────────────────────────

async function importTextToNotebookLM(text: string, title?: string): Promise<boolean> {
  try {
    // Step 1: Open the add source dialog
    await openAddSourceDialog();

    // Step 2: Check if already on "粘贴复制的文字" sub-page (textarea visible)
    let textArea = await findTextareaByPlaceholder(
      ['在此处粘贴文字', '粘贴文字', '粘贴', 'Paste text here', 'Paste'],
      500
    );

    if (!textArea) {
      // Need to navigate to copied text sub-page first
      // First go back to main dialog if on another sub-page (e.g. URL input)
      const backButton = await findButtonByText(['arrow_back', '返回', 'Back'], 300);
      if (backButton) {
        backButton.click();
        await delay(500);
      }

      // Click "复制的文字" (Copied text) button
      const textButton = await findButtonByText(
        ['复制的文字', '复制的文本', 'Copied text', 'Text'],
        3000
      );
      if (!textButton) {
        throw new Error('Copied text button not found in dialog');
      }
      textButton.click();
      await delay(500);

      // Now find the textarea
      textArea = await findTextareaByPlaceholder(
        ['在此处粘贴文字', '粘贴文字', '粘贴', 'Paste text here', 'Paste'],
        3000
      );
    }

    if (!textArea) {
      // Last resort fallback: find any textarea in the dialog
      const dialogTextareas = getDialogTextareas();
      if (dialogTextareas.length === 0) {
        throw new Error('Text area not found');
      }
      textArea = dialogTextareas[dialogTextareas.length - 1];
    }

    // Step 3: Fill title if available
    if (title) {
      const titleInput = await findInputByPlaceholder(
        ['来源名称', '标题', 'Source name', 'Title', 'title'],
        2000
      );
      if (titleInput) {
        await fillInput(titleInput, title);
      }
    }

    // Step 4: Fill text content
    await fillInput(textArea, text);

    // Step 5: Click "插入" (Insert) button — wait longer for it to become enabled
    await delay(800);
    const insertButton = await findButtonByText(['插入', 'Insert'], 5000);
    if (!insertButton) {
      throw new Error('Insert button not found');
    }
    // Wait for button to be enabled (disabled while processing input)
    for (let i = 0; i < 10; i++) {
      if (!(insertButton as HTMLButtonElement).disabled) break;
      await delay(300);
    }
    insertButton.click();

    // Wait for dialog to close / import to complete
    for (let i = 0; i < 10; i++) {
      await delay(1000);
      if (!getMainDialog()) break;
    }

    return true;
  } catch (error) {
    console.error('Failed to import text:', error);
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────────

function getMainDialog(): Element | null {
  // Prefer Material dialog container (avoids matching emoji keyboard [role="dialog"])
  return document.querySelector('mat-dialog-container') || document.querySelector('.mat-mdc-dialog-container');
}

async function openAddSourceDialog(): Promise<void> {
  // Check if Material dialog is already open
  if (getMainDialog()) {
    return; // Dialog already open
  }

  // Find and click "添加来源" / "Add source" button
  const addButton = findAddSourceButton();
  if (!addButton) {
    throw new Error('Add source button not found');
  }
  addButton.click();
  await delay(500);

  // Wait for Material dialog to appear
  const dialog = await waitForElement('mat-dialog-container, .mat-mdc-dialog-container', 3000);
  if (!dialog) {
    throw new Error('Add source dialog did not open');
  }
}

function findAddSourceButton(): HTMLElement | null {
  // Try aria-label selectors (works for both EN and CN)
  const ariaSelectors = [
    'button[aria-label*="Add source"]',
    'button[aria-label*="添加来源"]',
  ];

  for (const selector of ariaSelectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }

  // Fallback: find by text content
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.trim() || '';
    if (text.includes('添加来源') || text.includes('Add source')) {
      return button;
    }
  }

  return null;
}

async function findButtonByText(
  texts: string[],
  timeout: number = 3000
): Promise<HTMLElement | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Search in Material dialog first, then fallback [role="dialog"], then document
    const containers = [
      getMainDialog(),
      document.querySelector('[role="dialog"]'),
      document,
    ].filter(Boolean) as (Element | Document)[];

    for (const container of containers) {
      // Search <button> elements
      const buttons = container.querySelectorAll('button');
      for (const button of buttons) {
        const btnText = button.textContent?.trim() || '';
        for (const text of texts) {
          if (btnText.includes(text)) {
            return button;
          }
        }
      }
      // Also search clickable spans (Material button labels) and walk up to button
      const spans = container.querySelectorAll('span.mdc-button__label, [class*="button__label"]');
      for (const span of spans) {
        const spanText = span.textContent?.trim() || '';
        for (const text of texts) {
          if (spanText === text) {
            const parentBtn = span.closest('button, [role="button"], a') as HTMLElement;
            if (parentBtn) return parentBtn;
            // If no button parent, the span's parent might be clickable
            return span.parentElement as HTMLElement;
          }
        }
      }
    }

    await delay(100);
  }

  return null;
}

async function findTextareaByPlaceholder(
  placeholders: string[],
  timeout: number = 3000
): Promise<HTMLTextAreaElement | HTMLInputElement | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Search both textarea and input elements
    const elements = document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
      'textarea, input[type="text"], input[type="url"], input:not([type])'
    );
    for (const el of elements) {
      const ph = el.placeholder?.toLowerCase() || '';
      for (const placeholder of placeholders) {
        if (ph.includes(placeholder.toLowerCase())) {
          return el;
        }
      }
    }

    // Also check contenteditable and role="textbox" elements within dialog
    const dialog = getMainDialog() || document.querySelector('[role="dialog"]');
    if (dialog) {
      const textboxes = dialog.querySelectorAll<HTMLElement>('[role="textbox"], [contenteditable="true"]');
      for (const tb of textboxes) {
        const ph = tb.getAttribute('aria-placeholder')?.toLowerCase()
          || tb.getAttribute('placeholder')?.toLowerCase()
          || tb.dataset?.placeholder?.toLowerCase()
          || '';
        for (const placeholder of placeholders) {
          if (ph.includes(placeholder.toLowerCase())) {
            return tb as unknown as HTMLTextAreaElement;
          }
        }
      }
    }

    await delay(100);
  }

  return null;
}

async function findInputByPlaceholder(
  placeholders: string[],
  timeout: number = 3000
): Promise<HTMLInputElement | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
    for (const input of inputs) {
      const ph = input.placeholder?.toLowerCase() || '';
      for (const placeholder of placeholders) {
        if (ph.includes(placeholder.toLowerCase())) {
          return input;
        }
      }
    }
    await delay(100);
  }

  return null;
}

function getDialogTextareas(): HTMLTextAreaElement[] {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return [];
  return Array.from(dialog.querySelectorAll<HTMLTextAreaElement>('textarea'));
}

async function fillInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): Promise<void> {
  element.focus();

  // Use native setter to bypass React's synthetic event system
  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      'value'
    )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
  } else {
    element.value = value;
  }

  // Dispatch events to trigger React/Angular state updates
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  // Also try InputEvent for frameworks that listen to it
  const nativeInputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: value,
  });
  element.dispatchEvent(nativeInputEvent);

  await delay(200);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Inline Rescue Banner ───────────────────────────────────

function injectRescueBanner(): void {
  // Don't duplicate
  if (document.getElementById('nlm-rescue-banner')) return;

  const failedUrls = getFailedSourceUrls();
  if (failedUrls.length === 0) return;

  const scrollArea = document.querySelector('.scroll-area-desktop');
  if (!scrollArea) return;

  const banner = document.createElement('div');
  banner.id = 'nlm-rescue-banner';
  banner.innerHTML = `
    <style>
      #nlm-rescue-banner {
        margin: 8px 12px;
        padding: 10px 12px;
        background: #fffbeb;
        border: 1px solid #fcd34d;
        border-radius: 10px;
        font-family: 'Google Sans', Roboto, sans-serif;
        font-size: 13px;
        color: #92400e;
        animation: nlm-fade-in 0.3s ease;
      }
      @keyframes nlm-fade-in {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #nlm-rescue-banner .nlm-rescue-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #nlm-rescue-banner .nlm-rescue-icon {
        width: 16px; height: 16px; flex-shrink: 0;
      }
      #nlm-rescue-banner .nlm-rescue-text { flex: 1; }
      #nlm-rescue-banner .nlm-rescue-btn {
        padding: 4px 12px;
        background: #f59e0b;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        transition: background 0.15s;
      }
      #nlm-rescue-banner .nlm-rescue-btn:hover { background: #d97706; }
      #nlm-rescue-banner .nlm-rescue-btn:disabled {
        opacity: 0.6; cursor: not-allowed;
      }
      #nlm-rescue-banner .nlm-rescue-details {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #fde68a;
        font-size: 12px;
        color: #78350f;
      }
      #nlm-rescue-banner .nlm-rescue-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 0;
        overflow: hidden;
      }
      #nlm-rescue-banner .nlm-rescue-item-url {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      #nlm-rescue-banner .nlm-rescue-status {
        flex-shrink: 0;
        font-size: 11px;
      }
      #nlm-rescue-banner .nlm-rescue-success { color: #16a34a; }
      #nlm-rescue-banner .nlm-rescue-error { color: #dc2626; }
      #nlm-rescue-banner .nlm-rescue-spinner {
        display: inline-block;
        width: 12px; height: 12px;
        border: 2px solid #fff;
        border-top-color: transparent;
        border-radius: 50%;
        animation: nlm-spin 0.6s linear infinite;
      }
      @keyframes nlm-spin { to { transform: rotate(360deg); } }
      #nlm-rescue-banner .nlm-dismiss {
        background: none; border: none; color: #b45309;
        cursor: pointer; font-size: 16px; padding: 0 2px;
        line-height: 1; flex-shrink: 0;
      }
      #nlm-rescue-banner .nlm-dismiss:hover { color: #92400e; }
    </style>
    <div class="nlm-rescue-header">
      <svg class="nlm-rescue-icon" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span class="nlm-rescue-text">
        <strong>${failedUrls.length}</strong> 个来源导入失败，可尝试抢救
      </span>
      <button class="nlm-rescue-btn" id="nlm-rescue-btn">
        ↻ 抢救
      </button>
      <button class="nlm-dismiss" id="nlm-rescue-dismiss" title="关闭">×</button>
    </div>
    <div class="nlm-rescue-details" id="nlm-rescue-details" style="display:none">
      ${failedUrls.map((url) => `
        <div class="nlm-rescue-item" data-url="${url}">
          <span class="nlm-rescue-item-url" title="${url}">${url}</span>
          <span class="nlm-rescue-status" data-status="pending">待抢救</span>
        </div>
      `).join('')}
    </div>
  `;

  scrollArea.insertBefore(banner, scrollArea.firstChild);

  // Button handlers
  document.getElementById('nlm-rescue-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('nlm-rescue-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<span class="nlm-rescue-spinner"></span> 抢救中...';

    // Show details
    const details = document.getElementById('nlm-rescue-details');
    if (details) details.style.display = 'block';

    // Send rescue request to background
    chrome.runtime.sendMessage({ type: 'RESCUE_SOURCES', urls: failedUrls }, (resp) => {
      const results = resp?.success ? resp.data : (resp || []);
      updateInlineBanner(results);
    });
  });

  document.getElementById('nlm-rescue-dismiss')?.addEventListener('click', () => {
    banner.remove();
  });
}

function updateInlineBanner(results: Array<{ url: string; status: string; title?: string; error?: string }>): void {
  const btn = document.getElementById('nlm-rescue-btn') as HTMLButtonElement;
  const successCount = results.filter((r) => r.status === 'success').length;
  const failCount = results.filter((r) => r.status === 'error').length;

  if (btn) {
    btn.innerHTML = `✓ 完成 (${successCount}/${results.length})`;
    btn.disabled = true;
    btn.style.background = successCount > 0 ? '#16a34a' : '#dc2626';
  }

  // Update text
  const textEl = document.querySelector('#nlm-rescue-banner .nlm-rescue-text');
  if (textEl) {
    textEl.innerHTML = `抢救完成：<strong>${successCount}</strong> 成功${failCount > 0 ? `，<strong>${failCount}</strong> 失败` : ''}`;
  }

  // Update individual items
  for (const result of results) {
    const item = document.querySelector(`#nlm-rescue-details .nlm-rescue-item[data-url="${CSS.escape(result.url)}"]`);
    if (!item) continue;
    const statusEl = item.querySelector('.nlm-rescue-status');
    if (statusEl) {
      if (result.status === 'success') {
        statusEl.className = 'nlm-rescue-status nlm-rescue-success';
        statusEl.textContent = `✓ ${result.title || '成功'}`;
      } else {
        statusEl.className = 'nlm-rescue-status nlm-rescue-error';
        statusEl.textContent = `✗ ${result.error || '失败'}`;
      }
    }
  }
}

// ─── Failed Source Detection ────────────────────────────────

function getFailedSourceUrls(): string[] {
  const urls: string[] = [];

  // NotebookLM uses Angular with class "single-source-error-container" for failed sources
  // The URL is in a .source-title span inside the container
  const errorContainers = document.querySelectorAll('.single-source-error-container');
  for (const container of errorContainers) {
    const titleEl = container.querySelector('.source-title');
    const text = titleEl?.textContent?.trim();
    if (text && /^https?:\/\//.test(text)) {
      urls.push(text);
    }
  }

  // Fallback: also check for mat-icon "info" near source titles with URL text
  if (urls.length === 0) {
    const sourceColumns = document.querySelectorAll('.source-title-column');
    for (const col of sourceColumns) {
      const row = col.closest('.single-source-container');
      if (!row) continue;
      const hasInfoIcon = row.querySelector('mat-icon')?.textContent?.trim() === 'info';
      if (!hasInfoIcon) continue;
      const titleEl = col.querySelector('.source-title');
      const text = titleEl?.textContent?.trim();
      if (text && /^https?:\/\//.test(text)) {
        urls.push(text);
      }
    }
  }

  return [...new Set(urls)];
}

async function waitForElement<T extends Element = Element>(
  selector: string,
  timeout: number = 5000
): Promise<T | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const selectors = selector.split(',').map((s) => s.trim());

    for (const sel of selectors) {
      try {
        const element = document.querySelector<T>(sel);
        if (element) return element;
      } catch {
        // Invalid selector, continue
      }
    }

    await delay(100);
  }

  return null;
}
