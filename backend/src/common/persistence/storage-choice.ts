/** The databases the server can run on. The ids match the installer's manifest. */
export const STORAGE_KIND = {
  MONGODB: 'mongodb',
  POSTGRES: 'postgres',
} as const;

export type StorageKind = (typeof STORAGE_KIND)[keyof typeof STORAGE_KIND];

export const STORAGE_KINDS: readonly StorageKind[] =
  Object.values(STORAGE_KIND);

/** The environment setting that names the database. */
export const STORAGE_KIND_VARIABLE = 'DATABASE_TYPE';

export const DEFAULT_STORAGE_KIND: StorageKind = STORAGE_KIND.MONGODB;

/** The first kind an adapter was picked for, kept to catch a later change. */
let picked: StorageKind | undefined;

function isStorageKind(value: unknown): value is StorageKind {
  return STORAGE_KINDS.some((kind) => kind === value);
}

/** Unset or blank is the default. Anything else must be a known database. */
export function storageKindOf(value: unknown): StorageKind {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_STORAGE_KIND;
  }
  if (!isStorageKind(value)) {
    const given = typeof value === 'string' ? `"${value}"` : typeof value;
    throw new Error(
      `${STORAGE_KIND_VARIABLE} must be one of ${STORAGE_KINDS.join(', ')}, got ${given}`,
    );
  }
  return value;
}

/** The database this process runs on, as the environment names it now. */
export function chosenStorage(): StorageKind {
  return storageKindOf(process.env[STORAGE_KIND_VARIABLE]);
}

/**
 * Picks one adapter's wiring when a module file is loaded. Module metadata is
 * fixed at load, so the choice is made here once and no service, guard or
 * controller ever asks which database it is on. The other adapter's providers
 * are never handed to a module, so nothing of it is built or connected.
 */
export function forStorage<Wiring>(
  adapters: Partial<Record<StorageKind, () => Wiring>>,
): Wiring {
  const kind = chosenStorage();
  const adapter = adapters[kind];
  if (!adapter) {
    throw new Error(
      `${STORAGE_KIND_VARIABLE} is "${kind}", and this build does not carry that adapter`,
    );
  }
  picked ??= kind;
  return adapter();
}

/**
 * Called with the validated setting. Refuses when a module already picked its
 * adapter under another value, which happens only if a module file was loaded
 * before the environment file was read.
 */
export function confirmStorageChoice(validated: unknown): void {
  const kind = storageKindOf(validated);
  if (picked !== undefined && picked !== kind) {
    throw new Error(
      `${STORAGE_KIND_VARIABLE} is "${kind}", but modules were already wired for "${picked}". Load the configuration before any module file.`,
    );
  }
}

/** For specs that load module files under more than one setting. */
export function forgetStorageChoice(): void {
  picked = undefined;
}
