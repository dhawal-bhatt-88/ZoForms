/**
 * Where a live example's form "submits" to.
 *
 * FormRenderer posts its payload with `fetch(endpoint)`. In the docs nothing
 * should leave the page, and there is no server to receive it, so each example
 * passes an endpoint under EXAMPLE_ENDPOINT_PREFIX and registers a handler for
 * it here. While at least one handler is registered, window.fetch is wrapped:
 * a same-origin request to a registered path goes to its handler, and every
 * other request goes to the real fetch untouched. The wrapper is installed by
 * the first registration and removed with the last, so a page without a
 * mounted example never has it.
 *
 * Nothing else in the app patches fetch.
 */

export const EXAMPLE_ENDPOINT_PREFIX = "/__docs-example/";

export type ExampleHandler = (body: string) => Response;

const handlers = new Map<string, ExampleHandler>();
let original: typeof fetch | null = null;

/** Set on the wrapper so a test (or a curious reader) can tell it from the real fetch. */
export const SHIM_MARK = "__zoworkDocsExampleFetch";

function shim(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, location.href);
  const handler = url.origin === location.origin ? handlers.get(url.pathname) : undefined;
  if (handler) {
    try {
      return Promise.resolve(handler(typeof init?.body === "string" ? init.body : ""));
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return original!(input, init);
}
Object.defineProperty(shim, SHIM_MARK, { value: true });

/** Handle requests to `path` until the returned function is called. */
export function registerExampleEndpoint(path: string, handler: ExampleHandler): () => void {
  if (!path.startsWith(EXAMPLE_ENDPOINT_PREFIX)) throw new Error(`Example endpoints start with ${EXAMPLE_ENDPOINT_PREFIX}`);
  if (handlers.has(path)) throw new Error(`${path} already has a handler`);
  handlers.set(path, handler);
  if (!original) {
    original = window.fetch;
    window.fetch = shim;
  }
  return () => {
    handlers.delete(path);
    // Restored only if nothing has wrapped fetch since; otherwise the wrapper
    // stays in their chain and, with no handlers left, just passes through.
    if (handlers.size === 0 && original && window.fetch === shim) {
      window.fetch = original;
      original = null;
    }
  };
}
