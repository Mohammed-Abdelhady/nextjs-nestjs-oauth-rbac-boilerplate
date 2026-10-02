/**
 * Cache tags for a mutation that only invalidates when it succeeds. A plain
 * tag list also invalidates on a rejection, which refetches data the server
 * did not change.
 *
 * @example
 * ```ts
 * invalidatesTags: invalidateOnSuccess(['User']),
 * invalidatesTags: invalidateOnSuccess(({ userId }) => [{ type: 'User', id: userId }]),
 * ```
 */
export function invalidateOnSuccess<const Tag, Arg = unknown>(
  tags: readonly Tag[] | ((arg: Arg) => readonly Tag[]),
): (result: unknown, error: unknown, arg: Arg) => readonly Tag[] {
  return (_result, error, arg) => {
    if (error) return [];
    return typeof tags === 'function' ? tags(arg) : tags;
  };
}
