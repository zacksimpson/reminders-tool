const { withAppBuildGradle } = require("@expo/config-plugins");

const DEBUG_BLOCK_REGEX =
  /(\s+debug\s*\{)(\s+signingConfig signingConfigs\.debug)/;

module.exports = function withDebugApplicationIdSuffix(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes('applicationIdSuffix ".debug"')) {
      return config;
    }

    config.modResults.contents = contents.replace(
      DEBUG_BLOCK_REGEX,
      '$1\n            applicationIdSuffix ".debug"$2'
    );

    return config;
  });
};
