const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const projectRoot = __dirname;

config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      if (name === '@') {
        return projectRoot;
      }
      return path.join(projectRoot, 'node_modules', name);
    },
  }
);

config.watchFolders = [projectRoot];

module.exports = config;
