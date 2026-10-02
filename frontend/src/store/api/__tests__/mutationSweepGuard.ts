/**
 * Classification guard for the mutation invalidation sweep. Kept free of any
 * api slice import: what a guard sees is the import graph of its test file,
 * since every injected slice shares one endpoint object.
 */

/** One endpoint registry of an api slice, mapping names to endpoint objects. */
export interface EndpointRegistry {
  endpoints: Record<string, object>;
}

/**
 * Mutation endpoint names the test file's import graph holds that no case
 * list classifies. A guard test asserts this stays empty on one registry
 * (the objects are shared), so a new mutation of any slice its graph imports
 * must join a case list before the sweep stays green. A guard that imports
 * one feature's slice alone lists only that slice's endpoints, which keeps
 * feature guards decoupled from every other feature.
 */
export function unclassifiedMutationNames(
  registry: EndpointRegistry,
  classifiedNames: readonly string[],
): string[] {
  const unclassified: string[] = [];
  for (const [name, endpoint] of Object.entries(registry.endpoints)) {
    // The React module tags every mutation endpoint with `useMutation`.
    if ('useMutation' in endpoint && !classifiedNames.includes(name)) {
      unclassified.push(name);
    }
  }
  return unclassified;
}
