const MISSING_INDEX_CODES = new Set([26, 27]);
const MISSING_INDEX_NAMES = new Set([
  'IndexNotFound',
  'NamespaceNotFound',
]);

async function dropIndexIfExists(collection, name) {
  try {
    await collection.dropIndex(name);
    return true;
  } catch (error) {
    if (
      error &&
      (MISSING_INDEX_CODES.has(error.code) ||
        MISSING_INDEX_NAMES.has(error.codeName))
    ) {
      return false;
    }
    throw error;
  }
}

module.exports = { dropIndexIfExists };
