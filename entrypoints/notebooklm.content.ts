// Content script for NotebookLM page automation
// Updated: 2026-02-22 — adapted to new NotebookLM UI

export default defineContentScript({
  matches: ['https://notebooklm.google.com/*'],
  runAt: 'document_idle',

  main() {
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
    });
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

    // Step 2: Click "复制的文字" (Copied text) button
    const textButton = await findButtonByText(
      ['复制的文字', '复制的文本', 'Copied text', 'Text'],
      3000
    );
    if (!textButton) {
      throw new Error('Copied text button not found in dialog');
    }
    textButton.click();
    await delay(500);

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
    const textArea = await findTextareaByPlaceholder(
      ['粘贴', 'Paste', '输入', '内容', 'content'],
      3000
    );
    if (!textArea) {
      // Fallback: find any large textarea in the dialog
      const dialogTextareas = getDialogTextareas();
      if (dialogTextareas.length === 0) {
        throw new Error('Text area not found');
      }
      await fillInput(dialogTextareas[dialogTextareas.length - 1], text);
    } else {
      await fillInput(textArea, text);
    }

    // Step 5: Click "插入" (Insert) button
    const insertButton = await findButtonByText(['插入', 'Insert'], 3000);
    if (!insertButton) {
      throw new Error('Insert button not found');
    }
    insertButton.click();

    await delay(1500);
    return true;
  } catch (error) {
    console.error('Failed to import text:', error);
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────────

async function openAddSourceDialog(): Promise<void> {
  // Check if dialog is already open
  const existingDialog = document.querySelector('[role="dialog"]');
  if (existingDialog) {
    return; // Dialog already open
  }

  // Find and click "添加来源" / "Add source" button
  const addButton = findAddSourceButton();
  if (!addButton) {
    throw new Error('Add source button not found');
  }
  addButton.click();
  await delay(500);

  // Wait for dialog to appear
  const dialog = await waitForElement('[role="dialog"]', 3000);
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
    // Search in dialog first, then entire document
    const containers = [
      document.querySelector('[role="dialog"]'),
      document,
    ].filter(Boolean) as (Element | Document)[];

    for (const container of containers) {
      const buttons = container.querySelectorAll('button');
      for (const button of buttons) {
        const btnText = button.textContent?.trim() || '';
        for (const text of texts) {
          if (btnText.includes(text)) {
            return button;
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
    const dialog = document.querySelector('[role="dialog"]');
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

// ─── Failed Source Detection ────────────────────────────────

function getFailedSourceUrls(): string[] {
  const urls: string[] = [];

  // Find error icons (Material Icons "info" used for failed sources)
  // Strategy: find spans containing URLs that are siblings/near error indicators
  const allSpans = document.querySelectorAll('span');
  const errorIcons = new Set<Element>();

  // Collect error icon elements
  document.querySelectorAll('img[alt*="错误"], img[alt*="error"]').forEach((el) => errorIcons.add(el));
  allSpans.forEach((span) => {
    if (span.textContent?.trim() === 'info' && span.classList.toString().includes('material')) {
      errorIcons.add(span);
    }
  });

  // For each error icon, walk up to find the source container and extract URL
  for (const icon of errorIcons) {
    let parent = icon.parentElement;
    for (let i = 0; i < 8 && parent; i++) {
      const spans = parent.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text && /^https?:\/\//.test(text)) {
          urls.push(text);
        }
      }
      // Also check for title/tooltip attributes
      const title = parent.getAttribute('title') || parent.getAttribute('aria-label');
      if (title && /^https?:\/\//.test(title)) {
        urls.push(title);
      }
      parent = parent.parentElement;
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
