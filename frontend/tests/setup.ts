// jsdom gaps used by the app shell and Leaflet.
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
if (!window.matchMedia) {
  window.matchMedia = (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
}
URL.createObjectURL ??= () => 'blob:test';
URL.revokeObjectURL ??= () => undefined;

// Node's fetch rejects jsdom AbortSignals; timeouts are not needed in tests.
const nodeFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => nodeFetch(input, { ...init, signal: undefined })) as typeof fetch;
