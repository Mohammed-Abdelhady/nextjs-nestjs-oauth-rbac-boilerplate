const { getDefaultConfig } = require('expo/metro-config');
const { withWorkspace } = require('@app/metro-config');

// There is no babel.config.js on purpose: with none present, Expo's Metro transformer applies
// its own preset, for the development server and for `expo export` alike.
module.exports = withWorkspace(getDefaultConfig(__dirname), __dirname);
