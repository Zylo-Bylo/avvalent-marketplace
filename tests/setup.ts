import { afterEach, vi } from "vitest";

function createStorageMock() {
  let store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => {
      store = new Map<string, string>();
    }),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
  };
}

const localStorageMock = createStorageMock();

vi.stubGlobal("localStorage", localStorageMock);

afterEach(() => {
  localStorageMock.clear();
  vi.restoreAllMocks();
});
