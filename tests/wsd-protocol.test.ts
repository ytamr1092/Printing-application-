import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  WSD_SCAN_ACTION_BASE,
  WSD_SCAN_ELEMENT_NAMESPACE,
  wsdScanActionUri,
  type WsdScanOperation,
} from "../shared/wsd-scanner";

const androidModule = readFileSync(
  fileURLToPath(new NodeURL("../native/android/src/main/java/com/app/printpilotsmart/PrintPilotWsdScannerModule.kt", import.meta.url)),
  "utf8",
);

const operations: WsdScanOperation[] = ["CreateScanJob", "GetJobElements", "RetrieveImage", "CancelJob"];

describe("WSD Scan SOAP contract", () => {
  it("keeps the XML element namespace separate from the SOAP Action base", () => {
    expect(WSD_SCAN_ELEMENT_NAMESPACE).toBe("https://schemas.microsoft.com/windows/2006/01/wdp/scan");
    expect(WSD_SCAN_ACTION_BASE).toBe("https://schemas.microsoft.com/windows/2006/01/wdp/scan");
    expect(androidModule).toContain(`private val scanElementNamespace = "${WSD_SCAN_ELEMENT_NAMESPACE}"`);
    expect(androidModule).toContain(`private val scanActionBase = "${WSD_SCAN_ACTION_BASE}"`);
    expect(androidModule).toContain('xmlns:wscn="$scanElementNamespace"');
    expect(androidModule).toContain('val action = "$scanActionBase/$operation"');
    expect(androidModule).toContain(String.raw`setRequestProperty("Content-Type", "application/soap+xml; charset=utf-8; action=\"$action\"")`);
    expect(androidModule).not.toContain("scanNamespace");
  });

  it.each(operations)("uses the exact HTTPS Action URI for %s", (operation) => {
    expect(wsdScanActionUri(operation)).toBe(`${WSD_SCAN_ACTION_BASE}/${operation}`);
    const callPattern = new RegExp(`(?:soap|soapBytes)\\([^\\n]*"${operation}"`);
    expect(androidModule).toMatch(callPattern);
  });

  it("accepts only ProbeMatches whose resolved service QName is WSD ScanDeviceType", () => {
    expect(androidModule).toContain('findElements(doc, "ProbeMatch").forEach');
    expect(androidModule).toContain("val serviceTypes = parseServiceTypes(match)");
    expect(androidModule).toContain('it.first == scanElementNamespace && it.second == "ScanDeviceType"');
    expect(androidModule).toContain("element.lookupNamespaceURI(prefix)");
    expect(androidModule).not.toContain("The multicast Probe already filters for ScanDeviceType");
  });

  it("polls progressive ADF documents through a terminal job state without truncating at 50", () => {
    expect(androidModule).toContain("discoveredNames.addAll(findTexts(result, \"DocumentName\")");
    expect(androidModule).toContain("state.contains(\"completed\")");
    expect(androidModule).toContain("completedwitherrors");
    expect(androidModule).toContain("clienterrornoimagesavailable");
    expect(androidModule).toContain("findText(result, \"ScansCompleted\")?.toLongOrNull()");
    expect(androidModule).toContain("expectedImages != retrievedNames.size.toLong()");
    expect(androidModule).toContain("15 * 60 * 1000");
    expect(androidModule).toContain("the partial scan was discarded");
    expect(androidModule).not.toMatch(/documentNames\.take\(50\)/);
  });
});
