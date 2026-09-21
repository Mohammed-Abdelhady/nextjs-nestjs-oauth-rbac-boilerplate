/**
 * Session authority records, indexes, and first-party application registrations.
 * Existing sessions without captured versions stay unusable until a new login.
 */

module.exports = {
  async up(db) {
    const applications = db.collection('applications');
    await applications.createIndex(
      { clientId: 1, environment: 1 },
      { unique: true, name: 'application_client_environment_unique' },
    );

    const grants = db.collection('userapplicationgrants');
    await grants.createIndex(
      { userId: 1, clientId: 1 },
      { unique: true, name: 'grant_user_client_unique' },
    );

    const sessions = db.collection('sessions');
    await sessions.createIndex(
      { user: 1, isValid: 1, createdAt: -1, _id: 1 },
      { name: 'session_user_active_created' },
    );
    await sessions.createIndex(
      { clientId: 1, isValid: 1 },
      { name: 'session_client_active' },
    );

    const now = new Date();
    const environments = ['development', 'test', 'production'];
    const webLifetime = 7 * 24 * 60 * 60 * 1000;
    const webIdle = 30 * 60 * 1000;
    const adminLifetime = 8 * 60 * 60 * 1000;
    const adminIdle = 15 * 60 * 1000;

    const docs = [];
    for (const environment of environments) {
      docs.push({
        clientId: 'web',
        displayName: 'Web',
        platform: 'web',
        environment,
        clientType: 'public',
        enabled: true,
        redirectUris: [],
        allowedOrigins: [],
        audiences: ['api'],
        allowedScopes: ['api'],
        policy: {
          absoluteLifetimeMs: webLifetime,
          idleLifetimeMs: webIdle,
        },
        sessionVersion: 0,
        policyVersion: 0,
        issuanceFence: 0,
        createdAt: now,
        updatedAt: now,
      });
      docs.push({
        clientId: 'admin',
        displayName: 'Admin',
        platform: 'admin',
        environment,
        clientType: 'confidential',
        enabled: true,
        redirectUris: [],
        allowedOrigins: [],
        audiences: ['api'],
        allowedScopes: ['api'],
        policy: {
          absoluteLifetimeMs: adminLifetime,
          idleLifetimeMs: adminIdle,
        },
        sessionVersion: 0,
        policyVersion: 0,
        issuanceFence: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const doc of docs) {
      await applications.updateOne(
        { clientId: doc.clientId, environment: doc.environment },
        { $setOnInsert: doc },
        { upsert: true },
      );
    }
  },

  async down(db) {
    const applications = db.collection('applications');
    await applications.dropIndex('application_client_environment_unique');
    const grants = db.collection('userapplicationgrants');
    await grants.dropIndex('grant_user_client_unique');
    const sessions = db.collection('sessions');
    await sessions.dropIndex('session_user_active_created');
    await sessions.dropIndex('session_client_active');
  },
};
