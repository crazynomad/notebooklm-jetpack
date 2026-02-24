// Content script for NotebookLM page automation
// Updated: 2026-02-22 — adapted to new NotebookLM UI

export default defineContentScript({
  matches: ['https://notebooklm.google.com/*'],
  runAt: 'document_idle',

  main() {
    // Prevent duplicate listener registration from multiple injections
    if ((window as unknown as Record<string, boolean>).__NLM_IMPORTER_LOADED__) return;
    (window as unknown as Record<string, boolean>).__NLM_IMPORTER_LOADED__ = true;

    console.log('NotebookLM Jetpack content script loaded');

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

      if (message.type === 'GET_WECHAT_SOURCES') {
        const urls = getWechatFakeSuccessSources();
        sendResponse({ success: true, data: urls });
        return true;
      }

      if (message.type === 'RESCUE_SOURCE_DONE') {
        // Update inline banner after rescue completes
        updateInlineBanner(message.results);
        sendResponse({ success: true });
        return true;
      }
    });

    // Auto-inject banners if issues detected
    setTimeout(() => {
      injectRescueBanner();
      injectRepairBanner();
    }, 2000);

    // Re-check when source list changes (new sources added, sources removed, etc.)
    let lastSourceCount = document.querySelectorAll('.single-source-container').length;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const currentCount = document.querySelectorAll('.single-source-container').length;
        const rescueBanner = document.getElementById('nlm-rescue-banner');
        const repairBanner = document.getElementById('nlm-repair-banner');

        if (currentCount !== lastSourceCount) {
          // Source count changed — remove and re-inject banners with updated counts
          lastSourceCount = currentCount;
          rescueBanner?.remove();
          repairBanner?.remove();
          injectRescueBanner();
          injectRepairBanner();
        } else {
          // Source count unchanged — just ensure banners exist
          if (!rescueBanner) injectRescueBanner();
          if (!repairBanner) injectRepairBanner();
        }
      }, 800);
    });
    const scrollArea = document.querySelector('.scroll-area-desktop');
    if (scrollArea) {
      observer.observe(scrollArea, { childList: true, subtree: true });
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

    // Step 6: Rename the newly created source (NotebookLM defaults to "粘贴的文字" or "Copied text")
    if (title) {
      await delay(4000); // Wait longer for source list to fully update (large pastes take time)
      try {
        // Try both Chinese and English default names
        let renamed = false;
        for (const defaultName of ['粘贴的文字', '复制的文字', 'Copied text', 'Pasted text']) {
          try {
            await renameSource(defaultName, title);
            renamed = true;
            break;
          } catch {
            // Try next default name
          }
        }
        if (!renamed) throw new Error('Source with default name not found');
        else console.log(`[rename] Renamed source to: ${title}`);
      } catch (e) {
        console.warn('[rename] Failed to rename source:', e);
        // Non-fatal: import succeeded even if rename fails
      }
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

// ─── Source Rename ──────────────────────────────────────────

/**
 * Rename a source in the source list by clicking its three-dot menu → "重命名来源".
 * Finds the LAST source matching `oldName` (most recently added).
 */
async function renameSource(oldName: string, newName: string): Promise<void> {
  // NotebookLM DOM: .single-source-container > .source-title-column (title) + .source-item-more-button (⋮)
  const allItems = document.querySelectorAll('.single-source-container');
  let targetMoreBtn: HTMLElement | null = null;

  // Search from last to first (most recently added source is at the bottom)
  for (let i = allItems.length - 1; i >= 0; i--) {
    const item = allItems[i];
    const titleEl = item.querySelector('.source-title-column');
    if (titleEl?.textContent?.trim() === oldName) {
      targetMoreBtn = item.querySelector('.source-item-more-button') as HTMLElement;
      if (!targetMoreBtn) {
        // Fallback: find button with aria-label="更多"
        targetMoreBtn = item.querySelector('button[aria-label="更多"], button[aria-label="More"]') as HTMLElement;
      }
      if (targetMoreBtn) break;
    }
  }

  if (!targetMoreBtn) {
    throw new Error(`Source "${oldName}" not found in source list`);
  }

  // Scroll the source into view first (it may be outside viewport)
  targetMoreBtn.scrollIntoView({ block: 'center', behavior: 'instant' });
  await delay(500);

  // Click the more button to open context menu, with retry (progressive delays for large pastes)
  const maxAttempts = 6;
  let renameItem: HTMLElement | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    targetMoreBtn.click();
    const waitMs = 600 + attempt * 400; // 600, 1000, 1400, 1800, 2200, 2600
    await delay(waitMs);

    renameItem = await findMenuItemByText(['重命名来源', 'Rename source', 'Rename'], 3000);
    if (renameItem) break;

    // Menu didn't open — dismiss any stale overlay and retry
    console.warn(`[rename] Attempt ${attempt + 1}/${maxAttempts}: menu not found, retrying...`);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await delay(800 + attempt * 300);
  }

  if (!renameItem) {
    throw new Error(`Rename menu item not found after ${maxAttempts} attempts`);
  }
  renameItem.click();
  await delay(800);

  // Find the rename dialog input (label: "来源名称")
  const renameInput = await findInputByPlaceholder(['来源名称', 'Source name'], 3000) 
    || await findInputByLabel(['来源名称', 'Source name'], 3000);
  if (!renameInput) {
    // Try Escape to close dialog
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    throw new Error('Rename input not found');
  }

  // Clear and fill with new name
  renameInput.select();
  await delay(100);
  await fillInput(renameInput, newName);

  // Click "保存" (Save) button
  const saveBtn = await findButtonByText(['保存', 'Save'], 3000);
  if (!saveBtn) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    throw new Error('Save button not found');
  }
  saveBtn.click();
  await delay(500);
}

/**
 * Find a menu item by text (inside mat-menu-panel or similar menu).
 */
async function findMenuItemByText(
  texts: string[],
  timeout: number = 3000
): Promise<HTMLElement | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const items = document.querySelectorAll('[role="menuitem"], .mat-menu-item, .mat-mdc-menu-item, button[mat-menu-item]');
    for (const item of items) {
      const itemText = item.textContent?.trim() || '';
      for (const text of texts) {
        if (itemText.includes(text)) {
          return item as HTMLElement;
        }
      }
    }
    await delay(100);
  }
  return null;
}

/**
 * Find an input by its associated label text (for Angular Material mat-label).
 */
async function findInputByLabel(
  labels: string[],
  timeout: number = 3000
): Promise<HTMLInputElement | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    // Angular Material: mat-label inside mat-form-field, input is sibling
    const matLabels = document.querySelectorAll('mat-label, label, .mat-mdc-floating-label');
    for (const lbl of matLabels) {
      const lblText = lbl.textContent?.trim()?.replace(/\*$/, '').trim() || '';
      for (const label of labels) {
        if (lblText === label || lblText.includes(label)) {
          // Find the input within the same form field
          const formField = lbl.closest('mat-form-field, .mat-mdc-form-field, .mat-form-field');
          if (formField) {
            const input = formField.querySelector('input') as HTMLInputElement;
            if (input) return input;
          }
          // Fallback: label's for attribute
          const forId = (lbl as HTMLLabelElement).htmlFor;
          if (forId) {
            const input = document.getElementById(forId) as HTMLInputElement;
            if (input) return input;
          }
        }
      }
    }
    await delay(100);
  }
  return null;
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
      #nlm-rescue-banner .nlm-rescue-footer {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #fde68a;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #nlm-rescue-banner .nlm-rescue-footer label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #78350f;
        cursor: pointer;
        flex: 1;
      }
      #nlm-rescue-banner .nlm-rescue-footer input[type="checkbox"] {
        accent-color: #f59e0b;
        width: 14px; height: 14px;
      }
      #nlm-rescue-banner .nlm-rescue-done-btn {
        padding: 6px 16px;
        background: #16a34a;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
      }
      #nlm-rescue-banner .nlm-rescue-done-btn:hover { background: #15803d; }
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

  // Hide the rescue button
  if (btn) btn.style.display = 'none';

  // Update text
  const textEl = document.querySelector('#nlm-rescue-banner .nlm-rescue-text');
  if (textEl) {
    textEl.innerHTML = `抢救完成：<strong>${successCount}</strong> 成功${failCount > 0 ? `，<strong>${failCount}</strong> 失败` : ''}`;
  }

  // Show details
  const details = document.getElementById('nlm-rescue-details');
  if (details) details.style.display = 'block';

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

  // Add footer with done button + remove checkbox (only if at least one success)
  if (successCount > 0) {
    const banner = document.getElementById('nlm-rescue-banner');
    if (banner && !document.getElementById('nlm-rescue-footer')) {
      const footer = document.createElement('div');
      footer.id = 'nlm-rescue-footer';
      footer.className = 'nlm-rescue-footer';
      footer.innerHTML = `
        <label>
          <input type="checkbox" id="nlm-rescue-remove-failed" checked />
          移除已抢救的失败来源
        </label>
        <button class="nlm-rescue-done-btn" id="nlm-rescue-done-btn">✓ 完成</button>
      `;
      banner.appendChild(footer);

      document.getElementById('nlm-rescue-done-btn')?.addEventListener('click', async () => {
        const removeCheckbox = document.getElementById('nlm-rescue-remove-failed') as HTMLInputElement;
        if (removeCheckbox?.checked) {
          await removeFailedSources();
        }
        banner.remove();
      });
    }
  }
}

async function removeFailedSources(): Promise<void> {
  // Find a failed source and click its "更多" menu to access "移除所有失败的来源"
  const errorContainers = document.querySelectorAll('.single-source-error-container');
  if (errorContainers.length === 0) return;

  // Find the "更多" (more) button inside the first error container
  const firstError = errorContainers[0];
  const moreBtn = firstError.querySelector('button') as HTMLElement;
  if (!moreBtn) return;

  moreBtn.click();
  await delay(500);

  // Find "移除所有失败的来源" menu item
  const menuItems = document.querySelectorAll('[role="menuitem"], .mat-mdc-menu-item, button');
  for (const item of menuItems) {
    const text = item.textContent?.trim() || '';
    if (text.includes('移除所有失败的来源') || text.includes('Remove all failed')) {
      (item as HTMLElement).click();
      await delay(500);
      return;
    }
  }

  // Fallback: press Escape to close menu if we couldn't find the option
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

// ─── Failed Source Detection ────────────────────────────────

// ─── Repair Banner (WeChat fake-success) ────────────────────

function injectRepairBanner(): void {
  if (document.getElementById('nlm-repair-banner')) return;

  const wechatUrls = getWechatFakeSuccessSources();
  if (wechatUrls.length === 0) return;

  const scrollArea = document.querySelector('.scroll-area-desktop');
  if (!scrollArea) return;

  const banner = document.createElement('div');
  banner.id = 'nlm-repair-banner';
  banner.innerHTML = `
    <style>
      #nlm-repair-banner {
        margin: 8px 12px;
        padding: 10px 12px;
        background: #eff6ff;
        border: 1px solid #93c5fd;
        border-radius: 10px;
        font-family: 'Google Sans', Roboto, sans-serif;
        font-size: 13px;
        color: #1e40af;
        animation: nlm-fade-in 0.3s ease;
      }
      #nlm-repair-banner .nlm-repair-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #nlm-repair-banner .nlm-repair-icon {
        width: 16px; height: 16px; flex-shrink: 0;
      }
      #nlm-repair-banner .nlm-repair-text { flex: 1; }
      #nlm-repair-banner .nlm-repair-btn {
        padding: 4px 12px;
        background: #3b82f6;
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
      #nlm-repair-banner .nlm-repair-btn:hover { background: #2563eb; }
      #nlm-repair-banner .nlm-repair-btn:disabled {
        opacity: 0.6; cursor: not-allowed;
      }
      #nlm-repair-banner .nlm-repair-details {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #bfdbfe;
        font-size: 12px;
        color: #1e3a8a;
      }
      #nlm-repair-banner .nlm-repair-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 0;
        overflow: hidden;
      }
      #nlm-repair-banner .nlm-repair-item-url {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      #nlm-repair-banner .nlm-repair-status { flex-shrink: 0; font-size: 11px; }
      #nlm-repair-banner .nlm-repair-success { color: #16a34a; }
      #nlm-repair-banner .nlm-repair-error { color: #dc2626; }
      #nlm-repair-banner .nlm-repair-spinner {
        display: inline-block;
        width: 12px; height: 12px;
        border: 2px solid #fff;
        border-top-color: transparent;
        border-radius: 50%;
        animation: nlm-spin 0.6s linear infinite;
      }
      #nlm-repair-banner .nlm-repair-footer {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #bfdbfe;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #nlm-repair-banner .nlm-repair-footer label {
        display: flex; align-items: center; gap: 6px;
        font-size: 12px; color: #1e3a8a; cursor: pointer; flex: 1;
      }
      #nlm-repair-banner .nlm-repair-footer input[type="checkbox"] {
        accent-color: #3b82f6; width: 14px; height: 14px;
      }
      #nlm-repair-banner .nlm-repair-done-btn {
        padding: 6px 16px; background: #16a34a; color: white;
        border: none; border-radius: 6px; font-size: 12px;
        font-weight: 500; cursor: pointer;
      }
      #nlm-repair-banner .nlm-repair-done-btn:hover { background: #15803d; }
      #nlm-repair-banner .nlm-dismiss {
        background: none; border: none; color: #3b82f6;
        cursor: pointer; font-size: 16px; padding: 0 2px;
        line-height: 1; flex-shrink: 0;
      }
    </style>
    <div class="nlm-repair-header">
      <svg class="nlm-repair-icon" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <span class="nlm-repair-text">
        <strong>${wechatUrls.length}</strong> 个微信公众号来源需要修复
      </span>
      <button class="nlm-repair-btn" id="nlm-repair-btn">
        🔧 修复
      </button>
      <button class="nlm-dismiss" id="nlm-repair-dismiss" title="关闭">×</button>
    </div>
    <div class="nlm-repair-details" id="nlm-repair-details" style="display:none">
      ${wechatUrls.map((url) => `
        <div class="nlm-repair-item" data-url="${url}">
          <span class="nlm-repair-item-url" title="${url}">${url}</span>
          <span class="nlm-repair-status" data-status="pending">待修复</span>
        </div>
      `).join('')}
    </div>
  `;

  // Insert after rescue banner if it exists, otherwise at top
  const rescueBanner = document.getElementById('nlm-rescue-banner');
  if (rescueBanner && rescueBanner.nextSibling) {
    scrollArea.insertBefore(banner, rescueBanner.nextSibling);
  } else if (rescueBanner) {
    scrollArea.appendChild(banner);
  } else {
    scrollArea.insertBefore(banner, scrollArea.firstChild);
  }

  document.getElementById('nlm-repair-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('nlm-repair-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<span class="nlm-repair-spinner"></span> 修复中...';
    const details = document.getElementById('nlm-repair-details');
    if (details) details.style.display = 'block';

    chrome.runtime.sendMessage({ type: 'REPAIR_WECHAT_SOURCES', urls: wechatUrls }, (resp) => {
      const results = resp?.success ? resp.data : (resp || []);
      updateRepairBanner(results, wechatUrls);
    });
  });

  document.getElementById('nlm-repair-dismiss')?.addEventListener('click', () => {
    banner.remove();
  });
}

function updateRepairBanner(results: Array<{ url: string; status: string; title?: string; error?: string }>, originalUrls: string[]): void {
  const btn = document.getElementById('nlm-repair-btn') as HTMLButtonElement;
  const successCount = results.filter((r) => r.status === 'success').length;
  const failCount = results.filter((r) => r.status === 'error').length;

  if (btn) btn.style.display = 'none';

  const textEl = document.querySelector('#nlm-repair-banner .nlm-repair-text');
  if (textEl) {
    textEl.innerHTML = `修复完成：<strong>${successCount}</strong> 成功${failCount > 0 ? `，<strong>${failCount}</strong> 失败` : ''}`;
  }

  for (const result of results) {
    const item = document.querySelector(`#nlm-repair-details .nlm-repair-item[data-url="${CSS.escape(result.url)}"]`);
    if (!item) continue;
    const statusEl = item.querySelector('.nlm-repair-status');
    if (statusEl) {
      if (result.status === 'success') {
        statusEl.className = 'nlm-repair-status nlm-repair-success';
        statusEl.textContent = `✓ ${result.title || '成功'}`;
      } else {
        statusEl.className = 'nlm-repair-status nlm-repair-error';
        statusEl.textContent = `✗ ${result.error || '失败'}`;
      }
    }
  }

  if (successCount > 0) {
    const bannerEl = document.getElementById('nlm-repair-banner');
    if (bannerEl && !document.getElementById('nlm-repair-footer')) {
      const footer = document.createElement('div');
      footer.id = 'nlm-repair-footer';
      footer.className = 'nlm-repair-footer';
      footer.innerHTML = `
        <label>
          <input type="checkbox" id="nlm-repair-remove-old" checked />
          移除原始微信来源
        </label>
        <button class="nlm-repair-done-btn" id="nlm-repair-done-btn">✓ 完成</button>
      `;
      bannerEl.appendChild(footer);

      document.getElementById('nlm-repair-done-btn')?.addEventListener('click', async () => {
        const removeCheckbox = document.getElementById('nlm-repair-remove-old') as HTMLInputElement;
        if (removeCheckbox?.checked) {
          await removeSourcesByUrl(originalUrls);
        }
        bannerEl.remove();
      });
    }
  }
}

async function removeSourcesByUrl(urls: string[]): Promise<void> {
  for (const url of urls) {
    // Find the source item with this URL title
    const sources = document.querySelectorAll('.source-title');
    for (const source of sources) {
      if (source.textContent?.trim() !== url) continue;
      const container = source.closest('.single-source-container');
      if (!container) continue;

      // Click the "更多" menu button
      const menuBtn = container.querySelector('button') as HTMLElement;
      if (!menuBtn) continue;
      menuBtn.click();
      await delay(500);

      // Find "移除来源" menu item
      const menuItems = document.querySelectorAll('[role="menuitem"], .mat-mdc-menu-item');
      for (const item of menuItems) {
        const text = item.textContent?.trim() || '';
        if (text.includes('移除来源') || text.includes('Remove source')) {
          (item as HTMLElement).click();
          await delay(1000);
          break;
        }
      }
      break;
    }
  }
}

// ─── WeChat Fake-Success Detection ──────────────────────────

function getWechatFakeSuccessSources(): string[] {
  const urls: string[] = [];
  const sources = document.querySelectorAll('.source-title');
  sources.forEach((s) => {
    const text = s.textContent?.trim();
    if (text && /^https?:\/\/mp\.weixin\.qq\.com\//.test(text)) {
      const container = s.closest('.single-source-container');
      // Only include non-error ones (error ones are handled by rescue)
      if (container && !container.classList.contains('single-source-error-container')) {
        urls.push(text);
      }
    }
  });
  return [...new Set(urls)];
}

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
