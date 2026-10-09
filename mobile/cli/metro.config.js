const { getDefaultConfig } = require('@react-native/metro-config');
const { withWorkspace } = require('@app/metro-config');

module.exports = withWorkspace(getDefaultConfig(__dirname), __dirname);
