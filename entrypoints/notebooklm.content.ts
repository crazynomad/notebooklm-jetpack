// Content script for NotebookLM page automation
export default defineContentScript({
  matches: ['https://notebooklm.google.com/*'],
  runAt: 'document_idle',

  main() {
    console.log('NotebookLM Importer content script loaded');

    // Listen for import messages from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'IMPORT_URL') {
        importUrlToNotebookLM(message.url)
          .then((success) => sendResponse({ success }))
          .catch((error) => {
            console.error('Import error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Will respond asynchronously
      }

      if (message.type === 'IMPORT_TEXT') {
        importTextToNotebookLM(message.text, message.title)
          .then((success) => sendResponse({ success }))
          .catch((error) => {
            console.error('Import text error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Will respond asynchronously
      }
    });
  },
});

async function importUrlToNotebookLM(url: string): Promise<boolean> {
  try {
    // Wait for page to be ready
    await waitForElement('[data-testid="add-source-button"], button[aria-label*="Add source"]');

    // Step 1: Click "Add source" button
    const addSourceButton = findAddSourceButton();
    if (!addSourceButton) {
      throw new Error('Add source button not found');
    }
    addSourceButton.click();
    await delay(500);

    // Step 2: Find and click "Website" or "Link" option
    const linkOption = await waitForElement<HTMLElement>(
      '[data-testid="source-type-link"], [data-value="WEBSITE"], button:has-text("Website"), button:has-text("Link")',
      3000
    );
    if (linkOption) {
      linkOption.click();
      await delay(300);
    }

    // Step 3: Find URL input field and enter URL
    const urlInput = await waitForElement<HTMLInputElement>(
      'input[type="url"], input[placeholder*="URL"], input[placeholder*="url"], input[aria-label*="URL"]',
      3000
    );
    if (!urlInput) {
      throw new Error('URL input field not found');
    }

    // Clear and set value
    urlInput.focus();
    urlInput.value = '';
    urlInput.value = url;

    // Dispatch events to trigger React state update
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    urlInput.dispatchEvent(new Event('change', { bubbles: true }));
    await delay(200);

    // Step 4: Click submit/add button
    const submitButton = findSubmitButton();
    if (!submitButton) {
      throw new Error('Submit button not found');
    }
    submitButton.click();

    // Wait for import to complete
    await delay(1000);

    return true;
  } catch (error) {
    console.error('Failed to import URL:', error);
    return false;
  }
}

function findAddSourceButton(): HTMLElement | null {
  // Try various selectors for the Add Source button
  const selectors = [
    '[data-testid="add-source-button"]',
    'button[aria-label*="Add source"]',
    'button[aria-label*="添加来源"]',
    'button:has(svg[data-icon="add"])',
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) return element;
    } catch {
      // Selector might be invalid, continue
    }
  }

  // Fallback: find button with "Add" or "+" text
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || '';
    if (text.includes('add source') || text.includes('添加来源')) {
      return button;
    }
  }

  return null;
}

function findSubmitButton(): HTMLElement | null {
  const selectors = [
    '[data-testid="submit-source-button"]',
    'button[type="submit"]',
    'button[aria-label*="Insert"]',
    'button[aria-label*="Add"]',
    'button[aria-label*="Submit"]',
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector<HTMLElement>(selector);
      if (element && isVisible(element)) return element;
    } catch {
      // Selector might be invalid, continue
    }
  }

  // Fallback: find primary/submit button in dialog
  const dialog = document.querySelector('[role="dialog"], [data-testid="dialog"]');
  if (dialog) {
    const buttons = dialog.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent?.toLowerCase() || '';
      if (
        text.includes('insert') ||
        text.includes('add') ||
        text.includes('submit') ||
        text.includes('插入') ||
        text.includes('添加')
      ) {
        return button;
      }
    }
  }

  return null;
}

async function importTextToNotebookLM(text: string, title?: string): Promise<boolean> {
  try {
    // Wait for page to be ready
    await waitForElement('[data-testid="add-source-button"], button[aria-label*="Add source"]');

    // Step 1: Click "Add source" button
    const addSourceButton = findAddSourceButton();
    if (!addSourceButton) {
      throw new Error('Add source button not found');
    }
    addSourceButton.click();
    await delay(500);

    // Step 2: Find and click "Copied text" or "Text" option
    const textOption = await waitForElement<HTMLElement>(
      '[data-testid="source-type-text"], [data-value="TEXT"], button:has-text("Copied text"), button:has-text("Text"), button:has-text("复制的文本"), button:has-text("文本")',
      3000
    );
    if (textOption) {
      textOption.click();
      await delay(300);
    }

    // Step 3: Find title input field and enter title (if available)
    if (title) {
      const titleInput = await waitForElement<HTMLInputElement>(
        'input[placeholder*="title"], input[placeholder*="Title"], input[placeholder*="标题"], input[aria-label*="title"], input[aria-label*="Title"]',
        2000
      );
      if (titleInput) {
        titleInput.focus();
        titleInput.value = '';
        titleInput.value = title;
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(200);
      }
    }

    // Step 4: Find text area and enter content
    const textArea = await waitForElement<HTMLTextAreaElement>(
      'textarea[placeholder*="Paste"], textarea[placeholder*="paste"], textarea[placeholder*="粘贴"], textarea[aria-label*="content"], textarea[aria-label*="Content"], textarea',
      3000
    );
    if (!textArea) {
      throw new Error('Text area not found');
    }

    // Clear and set value
    textArea.focus();
    textArea.value = '';
    textArea.value = text;

    // Dispatch events to trigger React state update
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
    textArea.dispatchEvent(new Event('change', { bubbles: true }));
    await delay(200);

    // Step 5: Click submit/add button
    const submitButton = findSubmitButton();
    if (!submitButton) {
      throw new Error('Submit button not found');
    }
    submitButton.click();

    // Wait for import to complete
    await delay(1000);

    return true;
  } catch (error) {
    console.error('Failed to import text:', error);
    return false;
  }
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetParent !== null
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForElement<T extends Element = Element>(
  selector: string,
  timeout: number = 5000
): Promise<T | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Handle multiple selectors separated by comma
    const selectors = selector.split(',').map((s) => s.trim());

    for (const sel of selectors) {
      try {
        // Handle :has-text pseudo selector (not standard CSS)
        if (sel.includes(':has-text(')) {
          const match = sel.match(/^(.+?):has-text\("(.+?)"\)$/);
          if (match) {
            const [, baseSelector, text] = match;
            const elements = document.querySelectorAll<HTMLElement>(baseSelector);
            for (const el of elements) {
              if (el.textContent?.includes(text)) {
                return el as unknown as T;
              }
            }
          }
        } else {
          const element = document.querySelector<T>(sel);
          if (element) return element;
        }
      } catch {
        // Invalid selector, continue
      }
    }

    await delay(100);
  }

  return null;
}
