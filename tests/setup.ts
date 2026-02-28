// Mock chrome API
const storageMock: Record<string, unknown> = {};

const chromeMock = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    lastError: null as chrome.runtime.LastError | null,
    getURL: (path: string) => `chrome-extension://mock-id/${path}`,
    getContexts: vi.fn().mockResolvedValue([]),
  },
  offscreen: {
    createDocument: vi.fn().mockResolvedValue(undefined),
    Reason: { DOM_PARSER: 'DOM_PARSER' },
  },
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: storageMock[keys] });
        }
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          result[key] = storageMock[key];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(storageMock, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        const keyList = typeof keys === 'string' ? [keys] : keys;
        for (const key of keyList) {
          delete storageMock[key];
        }
        return Promise.resolve();
      }),
    },
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    sendMessage: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  scripting: {
    executeScript: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn(),
  },
  identity: {
    getAuthToken: vi.fn(),
    removeCachedAuthToken: vi.fn(),
  },
};

// @ts-expect-error mock
globalThis.chrome = chromeMock;

// Helper to reset storage between tests
export function resetStorage() {
  Object.keys(storageMock).forEach((key) => delete storageMock[key]);
}

export { storageMock };
