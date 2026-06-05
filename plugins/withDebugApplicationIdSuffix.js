const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withDebugApplicationIdSuffix(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes('applicationIdSuffix ".debug"')) {
      return config;
    }

    config.modResults.contents = contents.replace(
      /(\s+debug\s*\{)(\s+signingConfig signingConfigs\.debug)/,
      '$1\n            applicationIdSuffix ".debug"$2'
    );

    return config;
  });
};
