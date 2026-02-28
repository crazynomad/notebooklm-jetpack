/**
 * Shared offscreen document manager.
 *
 * MV3 service workers lack DOM APIs (DOMParser, document, etc.).
 * This module ensures a single offscreen document is available and
 * provides helpers to delegate DOM-dependent work to it.
 */

let offscreenReady = false;

export async function ensureOffscreen(): Promise<void> {
  if (offscreenReady) return;
  const contexts = await (chrome.runtime as unknown as { getContexts(f: { contextTypes: string[] }): Promise<{ documentUrl: string }[]> })
    .getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) {
    offscreenReady = true;
    return;
  }
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.DOM_PARSER],
    justification: 'DOM-dependent operations: HTML→Markdown, XML parsing',
  });
  offscreenReady = true;
  console.log('[offscreen] Document created');
}

/** Send a message to the offscreen document and return the response. */
export function sendOffscreenMessage<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.success) {
        resolve(response as T);
      } else {
        reject(new Error(response?.error || 'Unknown offscreen error'));
      }
    });
  });
}
