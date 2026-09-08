/**
 * migrate-mongo configuration
 *
 * This file configures the migrate-mongo library for database migrations.
 * It uses the MONGO_URI environment variable for the database connection.
 */

const config = {
  mongodb: {
    // Use MONGO_URI from environment or fallback to localhost
    url: process.env.MONGO_URI || 'mongodb://localhost:27017/authboiler',

    options: {},
  },

  // The directory where migration files are stored
  migrationsDir: 'migrations',

  // The name of the collection that stores migration state
  changelogCollectionName: 'migrations',

  // The file name format for migration files
  // {timestamp}-{name}.js
  migrationFileExtension: '.js',

  // Whether to use a custom template for migration files
  // We'll use the default template which provides up/down functions
  useFileHashing: false,
};

module.exports = config;
