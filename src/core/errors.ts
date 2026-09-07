/** Configuration mistake — unknown provider, missing API key, missing `to`, etc. */
export class AnymailConfigError extends Error {
  override readonly name = "AnymailConfigError";
  constructor(message: string) {
    super(message);
  }
}

/** A provider rejected the send, or the HTTP call failed. */
export class AnymailError extends Error {
  override readonly name = "AnymailError";
  /** The provider id that failed. */
  readonly provider: string;
  /** HTTP status, when the failure came with a response. */
  readonly status: number | undefined;
  /** Raw (truncated) response body, when there was one. */
  readonly responseBody: string | undefined;

  constructor(
    provider: string,
    message: string,
    opts: { status?: number; responseBody?: string; cause?: unknown } = {},
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.provider = provider;
    this.status = opts.status;
    this.responseBody = opts.responseBody;
  }
}
