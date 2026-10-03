/**
 * What `fetch$()` fails with when a 2xx payload reports failure (see `FetchConfig.isSuccess`),
 * after `failedFn` and the error toast have run. `response` is that payload.
 */
export class FetchFailedError<TRes = unknown> extends Error {
  override readonly name = 'FetchFailedError';

  constructor(
    readonly response: TRes,
    message: string,
  ) {
    super(message);
  }
}
