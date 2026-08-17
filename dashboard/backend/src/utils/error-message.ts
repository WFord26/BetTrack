/**
 * Error Narrowing Helpers
 *
 * Under `strict`, a catch clause binding is `unknown`. These helpers pull the
 * details handlers need out of an unknown error without widening it to `any`.
 *
 * Usage:
 *   try {
 *     await doWork();
 *   } catch (error) {
 *     res.status(500).json({ error: getErrorMessage(error) });
 *   }
 */

/**
 * Extracts a human-readable message from an unknown thrown value.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

export default getErrorMessage;
