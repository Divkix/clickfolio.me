// No-op AsyncLocalStorage for client builds where node:async_hooks is unavailable.
// vinext's headers.js shim imports AsyncLocalStorage but is tree-shaken in the client;
// this stub satisfies the import so Rollup doesn't error on the browser external.
export class AsyncLocalStorage {
  getStore() {
    return undefined;
  }
  run(_store, fn, ...args) {
    return fn(...args);
  }
  enterWith() {}
  disable() {}
}
