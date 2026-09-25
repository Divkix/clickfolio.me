// Test stub for `cloudflare:workflows`, which only exists in the Workers runtime.
export class NonRetryableError extends Error {
  constructor(message, name = "NonRetryableError") {
    super(message);
    this.name = name;
  }
}
