/**
 * YouTube request tunnel.
 *
 * YouTube's edge returns 403 ("Sorry...") for fetches whose Origin is
 * `chrome-extension://...`. To get around this without modifying forbidden
 * headers, we run the fetch inside a real youtube.com tab via
 * `chrome.scripting.executeScript` (default ISOLATED world). Origin is then
 * `https://www.youtube.com` and the request goes through.
 *
 * Tab strategy:
 *   - Reuse any existing youtube.com tab the user has open.
 *   - Otherwise create one inactive (hidden) tab and cache it.
 *   - The cached tab is closed after IDLE_TIMEOUT_MS of no use, so we don't
 *     leave a stray tab around forever. Only tabs we created are auto-closed.
 */

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

let cachedTabId: number | undefined;
let cachedTabCreatedByUs = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let pendingTab: Promise<{ tabId: number; createdByUs: boolean }> | undefined;

function scheduleIdleCleanup() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    idleTimer = undefined;
    if (cachedTabCreatedByUs && cachedTabId !== undefined) {
      try {
        await chrome.tabs.remove(cachedTabId);
      } catch {
        // Tab already gone
      }
    }
    cachedTabId = undefined;
    cachedTabCreatedByUs = false;
  }, IDLE_TIMEOUT_MS);
}

async function isTabAlive(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return !!tab && !!tab.url && tab.url.startsWith('https://www.youtube.com/');
  } catch {
    return false;
  }
}

async function waitForTabComplete(tabId: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    // Also resolve immediately if already complete
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }).catch(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    });
  });
}

async function getYouTubeTab(): Promise<{ tabId: number; createdByUs: boolean }> {
  // Reuse cached tab if still valid
  if (cachedTabId !== undefined && (await isTabAlive(cachedTabId))) {
    return { tabId: cachedTabId, createdByUs: cachedTabCreatedByUs };
  }
  cachedTabId = undefined;
  cachedTabCreatedByUs = false;

  // Serialize concurrent creation attempts
  if (pendingTab) return pendingTab;

  pendingTab = (async () => {
    // Try to find any user-owned youtube.com tab first
    const existing = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
    const userTab = existing.find((t) => t.id !== undefined);
    if (userTab?.id !== undefined) {
      cachedTabId = userTab.id;
      cachedTabCreatedByUs = false;
      return { tabId: userTab.id, createdByUs: false };
    }

    // Create a hidden inactive tab
    const created = await chrome.tabs.create({
      url: 'https://www.youtube.com/',
      active: false,
    });
    if (created.id === undefined) {
      throw new Error('Failed to create youtube.com tab');
    }
    await waitForTabComplete(created.id);
    cachedTabId = created.id;
    cachedTabCreatedByUs = true;
    return { tabId: created.id, createdByUs: true };
  })();

  try {
    return await pendingTab;
  } finally {
    pendingTab = undefined;
  }
}

interface TunnelResponse {
  ok: boolean;
  status: number;
  contentType: string | null;
  body: string;
}

/**
 * Run a fetch from inside a youtube.com tab. Returns the response as text
 * (caller decides whether to JSON.parse). Throws on tunnel/transport failure.
 */
async function tunnelFetch(
  path: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<TunnelResponse> {
  const { tabId } = await getYouTubeTab();
  scheduleIdleCleanup();

  const exec = async (): Promise<TunnelResponse> => {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (p: string, i: typeof init): Promise<TunnelResponse> => {
        try {
          const r = await fetch(p, {
            method: i?.method || 'GET',
            headers: { 'Content-Type': 'application/json', ...(i?.headers || {}) },
            body: i?.body,
            credentials: 'include',
          });
          const text = await r.text();
          return {
            ok: r.ok,
            status: r.status,
            contentType: r.headers.get('content-type'),
            body: text,
          };
        } catch (e) {
          return {
            ok: false,
            status: 0,
            contentType: null,
            body: e instanceof Error ? e.message : String(e),
          };
        }
      },
      args: [path, init || {}],
    });
    if (!result) throw new Error('Tunnel script returned no result');
    return result;
  };

  try {
    return await exec();
  } catch (err) {
    // Tab may have been closed/discarded between cache hit and exec — retry once
    cachedTabId = undefined;
    cachedTabCreatedByUs = false;
    const retryTab = await getYouTubeTab();
    scheduleIdleCleanup();
    if (retryTab.tabId !== tabId) {
      return await exec();
    }
    throw err;
  }
}

/** POST /youtubei/v1/browse with the given body, returns parsed JSON. */
export async function innertubeBrowse(body: object): Promise<unknown> {
  const resp = await tunnelFetch('/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`InnerTube tunnel failed: HTTP ${resp.status}`);
  }
  if (!resp.contentType?.includes('json')) {
    throw new Error(`InnerTube tunnel returned non-JSON: ${resp.contentType}`);
  }
  return JSON.parse(resp.body);
}

/** GET an arbitrary youtube.com path, returns the response body as text. */
export async function fetchYouTubeText(path: string): Promise<string> {
  const resp = await tunnelFetch(path, { method: 'GET' });
  if (!resp.ok) {
    throw new Error(`YouTube page fetch failed: HTTP ${resp.status}`);
  }
  return resp.body;
}
