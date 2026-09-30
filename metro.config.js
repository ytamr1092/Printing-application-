const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const nativeWindConfig = withNativeWind(config, {
  input: "./global.css",
});

// pdf-lib 1.x ships tslib 1.x with an ESM default-import bridge that Metro
// cannot unwrap consistently. Redirect only that internal bridge to the
// project-level tslib shim; all other packages keep Metro's normal resolver.
const defaultResolveRequest = nativeWindConfig.resolver.resolveRequest;
const pdfLibTslibShim = path.resolve(__dirname, "lib/tslib-pdf-lib-shim.js");
nativeWindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "../tslib.js" &&
    context.originModulePath.includes(`${path.sep}pdf-lib${path.sep}node_modules${path.sep}tslib${path.sep}modules`)
  ) {
    return { type: "sourceFile", filePath: pdfLibTslibShim };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = nativeWindConfig;
