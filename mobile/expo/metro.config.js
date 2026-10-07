const { getDefaultConfig } = require('expo/metro-config');
const { withWorkspace } = require('@app/metro-config');

module.exports = withWorkspace(getDefaultConfig(__dirname), __dirname);
