const { ObjectId } = require('mongodb');

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

const OBJECT_ID_REFERENCES = [
  { collection: 'sessions', field: 'user' },
  { collection: 'passkeys', field: 'user' },
  { collection: 'passkeychallenges', field: 'user' },
  { collection: 'twofactorchallenges', field: 'user' },
  {
    collection: 'userapplicationgrants',
    field: 'userId',
    uniqueWith: ['clientId'],
  },
  { collection: 'authorizationtransactions', field: 'userId' },
  { collection: 'nativecredentials', field: 'sessionId' },
  { collection: 'stepupchallenges', field: 'sessionId' },
  { collection: 'stepupchallenges', field: 'userId' },
];

function stringIdFilter(field) {
  return {
    [field]: { $type: 'string', $regex: OBJECT_ID_PATTERN },
    $expr: { $eq: [{ $type: `$${field}` }, 'string'] },
  };
}

// A string row cannot be converted onto an ObjectId row that already holds the
// same unique key, so the ObjectId row stays and the string row goes.
async function removeStringTwins(collection, field, uniqueWith) {
  const projection = Object.fromEntries(
    [field, ...uniqueWith].map((key) => [key, 1]),
  );
  let removed = 0;
  for await (const row of collection.find(stringIdFilter(field), {
    projection,
  })) {
    const twin = { [field]: ObjectId.createFromHexString(row[field]) };
    for (const key of uniqueWith) twin[key] = row[key];
    if ((await collection.countDocuments(twin, { limit: 1 })) === 0) continue;
    removed += (await collection.deleteOne({ _id: row._id })).deletedCount;
  }
  return removed;
}

module.exports = {
  OBJECT_ID_REFERENCES,

  async up(db) {
    for (const reference of OBJECT_ID_REFERENCES) {
      const { collection: collectionName, field, uniqueWith } = reference;
      if (uniqueWith) {
        const removed = await removeStringTwins(
          db.collection(collectionName),
          field,
          uniqueWith,
        );
        console.log(
          `Removed ${removed} string ids with an ObjectId twin in ${collectionName}.${field}`,
        );
      }
      const result = await db
        .collection(collectionName)
        .updateMany(stringIdFilter(field), [
          { $set: { [field]: { $toObjectId: `$${field}` } } },
        ]);

      console.log(
        `Converted ${result.modifiedCount} string ids in ${collectionName}.${field}`,
      );
    }
  },

  async down() {
    // Stringifying these values would restore the schema casting defect.
  },
};
