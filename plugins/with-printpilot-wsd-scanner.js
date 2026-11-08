const fs = require("fs");
const path = require("path");
const { withDangerousMod, withMainApplication } = require("expo/config-plugins");

const PACKAGE_NAME = "com.app.printpilotsmart";
const SOURCE_FILES = [
  "PrintPilotWsdScannerModule.kt",
  "PrintPilotWsdScannerPackage.kt",
];

module.exports = function withPrintPilotWsdScanner(config) {
  config = withMainApplication(config, (modConfig) => {
    if (modConfig.modResults.language !== "kt") {
      throw new Error("PrintPilot WSD scanner currently requires Kotlin MainApplication");
    }
    let contents = modConfig.modResults.contents;
    const registration = "add(PrintPilotWsdScannerPackage())";
    if (!contents.includes(registration)) {
      const marker = "PackageList(this).packages.apply {";
      if (!contents.includes(marker)) {
        throw new Error("Could not find the React Native package registration point for PrintPilotWsdScanner");
      }
      contents = contents.replace(marker, `${marker}\n              ${registration}`);
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = path.resolve(modConfig.modRequest.platformProjectRoot, "..");
      const sourceDir = path.join(projectRoot, "native", "android", "src", "main", "java", ...PACKAGE_NAME.split("."));
      const targetDir = path.join(modConfig.modRequest.platformProjectRoot, "app", "src", "main", "java", ...PACKAGE_NAME.split("."));
      fs.mkdirSync(targetDir, { recursive: true });
      for (const fileName of SOURCE_FILES) {
        const source = path.join(sourceDir, fileName);
        if (!fs.existsSync(source)) throw new Error(`Missing native WSD source: ${source}`);
        fs.copyFileSync(source, path.join(targetDir, fileName));
      }
      return modConfig;
    },
  ]);
};
