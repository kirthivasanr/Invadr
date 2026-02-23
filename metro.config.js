// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude Node.js-only packages from the mobile bundle.
// These are used by call.js (server-side) and must never be bundled into the app.
config.resolver.blockList = [
  /\/call\.js$/,                  // exclude the Twilio call script
  /\/node_modules\/twilio\//,     // exclude Twilio SDK entirely
];

// Ensure Metro resolves the correct asset extensions
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg',
);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
