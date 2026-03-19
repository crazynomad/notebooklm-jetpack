// NotebookLM internal API — list notebooks via batchexecute RPC
// Based on reverse-engineering from notebooklm-py (github.com/teng-lin/notebooklm-py)

const BATCHEXECUTE_URL = 'https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute';
const NLM_HOME_URL = 'https://notebooklm.google.com/';

// RPC method ID for listing notebooks
const RPC_LIST_NOTEBOOKS = 'wXbhsf';

// Cache config
const CACHE_KEY = 'notebook_list_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface NotebookCache {
  notebooks: NotebookItem[];
  cachedAt: number;
}

export interface NotebookItem {
  id: string;
  title: string;
  url: string;
}

/**
 * Extract CSRF token (SNlM0e) from NotebookLM homepage HTML.
 * The token is embedded in the page's JavaScript initialization.
 */
async function fetchCsrfToken(): Promise<string | null> {
  try {
    const resp = await fetch(NLM_HOME_URL, { credentials: 'include' });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Google embeds CSRF token as: "SNlM0e":"TOKEN_VALUE"
    const match = html.match(/"SNlM0e":"([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Encode an RPC request into batchexecute format.
 * Format: [[[rpc_id, json_params, null, "generic"]]]
 */
function encodeRpcRequest(rpcId: string, params: unknown[]): string {
  const paramsJson = JSON.stringify(params);
  const inner = [rpcId, paramsJson, null, 'generic'];
  return JSON.stringify([[inner]]);
}

/**
 * Strip anti-XSSI prefix from Google's batchexecute response.
 * Responses start with ")]}'" followed by a newline.
 */
function stripAntiXssi(text: string): string {
  const prefix = ")]}'";
  if (text.startsWith(prefix)) {
    return text.slice(prefix.length).trim();
  }
  return text;
}

async function getCachedNotebooks(): Promise<NotebookItem[] | null> {
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cache = result[CACHE_KEY] as NotebookCache | undefined;
    if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
      return cache.notebooks;
    }
  } catch { /* storage unavailable */ }
  return null;
}

async function setCachedNotebooks(notebooks: NotebookItem[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [CACHE_KEY]: { notebooks, cachedAt: Date.now() } satisfies NotebookCache,
    });
  } catch { /* storage unavailable */ }
}

/**
 * Fetch notebooks with cache support.
 * Returns cached data if within TTL, otherwise fetches fresh.
 * @param force - bypass cache and always fetch from API
 */
export async function fetchNotebooksCached(force = false): Promise<NotebookItem[]> {
  if (!force) {
    const cached = await getCachedNotebooks();
    if (cached && cached.length > 0) return cached;
  }
  const notebooks = await fetchNotebooks();
  if (notebooks.length > 0) {
    await setCachedNotebooks(notebooks);
  }
  return notebooks;
}

/**
 * Fetch notebook list from NotebookLM via internal batchexecute API.
 * Uses the extension's host permission — fetch() automatically includes cookies.
 */
export async function fetchNotebooks(): Promise<NotebookItem[]> {
  // Step 1: Get CSRF token from homepage
  const csrfToken = await fetchCsrfToken();
  if (!csrfToken) {
    console.warn('[notebook-api] Failed to get CSRF token — user may not be logged in');
    return [];
  }

  // Step 2: Build batchexecute request
  const params = [null, 1, null, [2]]; // LIST_NOTEBOOKS params
  const fReq = encodeRpcRequest(RPC_LIST_NOTEBOOKS, params);

  const urlParams = new URLSearchParams({
    rpcids: RPC_LIST_NOTEBOOKS,
    'source-path': '/',
    rt: 'c',
  });

  const body = `f.req=${encodeURIComponent(fReq)}&at=${encodeURIComponent(csrfToken)}&`;

  // Step 3: Make the RPC call
  try {
    const resp = await fetch(`${BATCHEXECUTE_URL}?${urlParams}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body,
    });

    if (!resp.ok) {
      console.error('[notebook-api] RPC failed:', resp.status);
      return [];
    }

    const text = await resp.text();
    return parseNotebookList(text);
  } catch (e) {
    console.error('[notebook-api] Fetch error:', e);
    return [];
  }
}

/**
 * Parse notebook list from batchexecute response.
 *
 * Response format (after anti-XSSI stripping):
 * Multiple lines of response chunks. The actual data is in a JSON-encoded
 * string within the response array.
 *
 * Each notebook in the response: [title, ???, id, ...]
 */
function parseNotebookList(rawText: string): NotebookItem[] {
  try {
    const cleaned = stripAntiXssi(rawText);

    // batchexecute response is chunked: each chunk has a length prefix line
    // followed by the JSON data. We need to extract the actual RPC result.
    // The format is: "number\n[[json_data]]\n"
    // We look for the array that contains our RPC response.
    const results: NotebookItem[] = [];

    // Find the main data array — look for lines that start with "[[" which
    // contain the RPC response envelope
    const lines = cleaned.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('[')) continue;

      try {
        const parsed = JSON.parse(trimmed);
        // batchexecute envelope: [["wrb.fr", "wXbhsf", "JSON_DATA", ...]]
        if (!Array.isArray(parsed)) continue;

        for (const outerItem of parsed) {
          if (!Array.isArray(outerItem)) continue;
          // Response may be 2-level [[rpc_result]] or 3-level [[[rpc_result]]].
          // Detect by checking if outerItem itself is an RPC result (first element is "wrb.fr").
          const candidates = outerItem[0] === 'wrb.fr' ? [outerItem] : outerItem.filter(Array.isArray);
          for (const item of candidates) {
            if (!Array.isArray(item)) continue;
            // Check if this is our RPC response: ["wrb.fr", "wXbhsf", "...", ...]
            if (item[0] === 'wrb.fr' && item[1] === RPC_LIST_NOTEBOOKS && typeof item[2] === 'string') {
              const innerData = JSON.parse(item[2]);
              // innerData[0] is the array of notebooks
              if (Array.isArray(innerData) && Array.isArray(innerData[0])) {
                for (const nb of innerData[0]) {
                  if (!Array.isArray(nb)) continue;
                  // nb[0] = title (may have "thought\n" prefix), nb[2] = id
                  const rawTitle = typeof nb[0] === 'string' ? nb[0] : '';
                  const title = rawTitle.replace(/^thought\n/, '').trim() || 'Untitled';
                  const id = typeof nb[2] === 'string' ? nb[2] : '';
                  if (id) {
                    results.push({
                      id,
                      title,
                      url: `https://notebooklm.google.com/notebook/${id}`,
                    });
                  }
                }
              }
              return results;
            }
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    return results;
  } catch (e) {
    console.error('[notebook-api] Parse error:', e);
    return [];
  }
}
