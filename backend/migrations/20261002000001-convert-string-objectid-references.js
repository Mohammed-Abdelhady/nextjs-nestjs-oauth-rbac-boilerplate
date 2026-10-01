const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

const OBJECT_ID_REFERENCES = [
  { collection: 'sessions', field: 'user' },
  { collection: 'passkeys', field: 'user' },
  { collection: 'passkeychallenges', field: 'user' },
  { collection: 'twofactorchallenges', field: 'user' },
  { collection: 'userapplicationgrants', field: 'userId' },
  { collection: 'authorizationtransactions', field: 'userId' },
  { collection: 'nativecredentials', field: 'sessionId' },
  { collection: 'stepupchallenges', field: 'sessionId' },
  { collection: 'stepupchallenges', field: 'userId' },
];

module.exports = {
  OBJECT_ID_REFERENCES,

  async up(db) {
    for (const { collection: collectionName, field } of OBJECT_ID_REFERENCES) {
      const result = await db.collection(collectionName).updateMany(
        {
          [field]: { $type: 'string', $regex: OBJECT_ID_PATTERN },
          $expr: { $eq: [{ $type: `$${field}` }, 'string'] },
        },
        [{ $set: { [field]: { $toObjectId: `$${field}` } } }],
      );

      console.log(
        `Converted ${result.modifiedCount} string ids in ${collectionName}.${field}`,
      );
    }
  },

  async down() {
    // Stringifying these values would restore the schema casting defect.
  },
};
