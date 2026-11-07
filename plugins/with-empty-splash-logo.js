// Android's splash theme always references @drawable/splashscreen_logo.
// We show no static splash image (the animated greeting is the splash), so
// provide a fully empty drawable instead of an image that Android draws as a square.
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const EMPTY_DRAWABLE = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="1dp"
    android:height="1dp"
    android:viewportWidth="1"
    android:viewportHeight="1" />
`;

module.exports = function withEmptySplashLogo(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, "app", "src", "main", "res", "drawable");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "splashscreen_logo.xml"), EMPTY_DRAWABLE);
      return cfg;
    },
  ]);
};
