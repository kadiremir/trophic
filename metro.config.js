const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure .web.js platform extensions are resolved for web builds
config.resolver.platforms = ['web', 'ios', 'android', 'native'];

module.exports = config;
