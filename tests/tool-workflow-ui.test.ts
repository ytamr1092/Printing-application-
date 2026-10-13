import React, { useState } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-native", async () => {
  const reactModule = await import("react");
  const ReactApi = reactModule.default ?? reactModule;
  const host =
    (tag: string) =>
    ({ children, onPress, ...props }: Record<string, any>) =>
      ReactApi.createElement(tag, { ...props, ...(onPress ? { onClick: onPress } : {}) }, children);
  return {
    ActivityIndicator: host("span"),
    Image: host("img"),
    Pressable: host("button"),
    ScrollView: host("div"),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: host("span"),
    TextInput: host("input"),
    View: host("div"),
  };
});

vi.mock("@expo/vector-icons/MaterialIcons", async () => {
  const reactModule = await import("react");
  const ReactApi = reactModule.default ?? reactModule;
  return {
    default: ({ name }: { name: string }) => ReactApi.createElement("span", { "data-icon": name }),
  };
});

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#0A7EA4",
    background: "#FFFFFF",
    surface: "#F8FAFC",
    foreground: "#071A2B",
    muted: "#4B6377",
    border: "#D8E0E8",
    error: "#B42332",
    success: "#16804A",
  }),
}));

vi.mock("@/components/pdf-document-preview", async () => {
  const reactModule = await import("react");
  const ReactApi = reactModule.default ?? reactModule;
  return {
    PdfDocumentPreview: () => ReactApi.createElement("div", { "data-testid": "pdf-preview" }),
  };
});

import { ToolWorkflowScreen } from "../components/tool-workflow-screen";

const firstFile = {
  uri: "file:///contract.pdf",
  name: "contract.pdf",
  size: 1200,
  mimeType: "application/pdf",
};
const secondFile = {
  uri: "file:///appendix.pdf",
  name: "appendix.pdf",
  size: 2400,
  mimeType: "application/pdf",
};

const workflowProps = (isArabic: boolean) => ({
  kind: "merge" as const,
  title: isArabic ? "معاينة دمج PDF" : "Merge PDF preview",
  isArabic,
  files: [firstFile, secondFile],
  previewFile: firstFile,
  frontUri: null,
  backUri: null,
  settings: {},
  result: null,
  error: null,
  processing: false,
  idBusy: false,
  canRun: true,
  onBack: vi.fn(),
  onPickFiles: vi.fn(),
  onPickIdFace: vi.fn(),
  onScanIdFace: vi.fn(),
  onSelectPreviewFile: vi.fn(),
  onMoveFile: vi.fn(),
  onRemoveFile: vi.fn(),
  onSettingChange: vi.fn(),
  onRun: vi.fn(),
  onShareResult: vi.fn(),
  onDismissError: vi.fn(),
});

function readText(renderer: ReactTestRenderer) {
  return renderer.root
    .findAllByType("span")
    .flatMap((instance: ReactTestInstance) => instance.children)
    .filter((child): child is string => typeof child === "string")
    .join(" ");
}

describe("tool workflow UI", () => {
  it("opens a titled full-screen tool and returns without losing the selected files", () => {
    function NavigationHarness() {
      const [opened, setOpened] = useState(false);
      const [files] = useState([firstFile, secondFile]);
      if (!opened)
        return React.createElement(
          "button",
          { onClick: () => setOpened(true), "aria-label": "open-merge-tool" },
          "Open merge tool",
        );
      return React.createElement(ToolWorkflowScreen, {
        ...workflowProps(true),
        files,
        previewFile: files[0],
        onBack: () => setOpened(false),
      });
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(NavigationHarness));
    });
    act(() => {
      renderer.root.findByProps({ "aria-label": "open-merge-tool" }).props.onClick();
    });

    expect(renderer.root.findByProps({ testID: "tool-workflow-screen" })).toBeTruthy();
    expect(readText(renderer)).toContain("معاينة دمج PDF");
    expect(readText(renderer)).toContain("contract.pdf");
    expect(readText(renderer)).toContain("appendix.pdf");

    const back = renderer.root.findByProps({ accessibilityLabel: "رجوع مع الاحتفاظ بالملفات" });
    act(() => (back.props.onPress ?? back.props.onClick)());
    act(() => {
      renderer.root.findByProps({ "aria-label": "open-merge-tool" }).props.onClick();
    });

    expect(readText(renderer)).toContain("contract.pdf");
    expect(readText(renderer)).toContain("appendix.pdf");
    expect(renderer.root.findByProps({ testID: "tool-workflow-header" })).toBeTruthy();
  });

  it.each([
    { language: "ar", isArabic: true, direction: "row-reverse", title: "معاينة دمج PDF", width: 320 },
    { language: "en", isArabic: false, direction: "row", title: "Merge PDF preview", width: 320 },
  ])("renders each language in the correct direction on a narrow 320px viewport", ({ isArabic, direction, title, width }) => {
    const props = workflowProps(isArabic);
    props.title = title;
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        React.createElement(
          "div",
          { style: { width } },
          React.createElement(ToolWorkflowScreen, props),
        ),
      );
    });
    const header = renderer.root.findByProps({ testID: "tool-workflow-header" });
    expect(JSON.stringify(header.props.style)).toContain(direction);
    expect(readText(renderer)).toContain(title);
    expect(renderer.root.findByProps({ testID: "tool-workflow-screen" })).toBeTruthy();
  });

  it("keeps ID library, camera, and Kyocera choices inside the full-screen flow", () => {
    const props = {
      ...workflowProps(true),
      kind: "id" as const,
      title: "بطاقة الهوية",
      files: [],
      previewFile: null,
      frontUri: null,
      backUri: null,
    };
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    expect(readText(renderer)).toContain("التقاط بالكاميرا");
    expect(readText(renderer)).toContain("مسح عبر Kyocera");
    expect(readText(renderer)).toContain("اختيار صورة");
  });

  it("contains no modal or bottom-sheet component in the tool navigation path", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const screenSource = readFileSync(path.resolve(process.cwd(), "components/tool-workflow-screen.tsx"), "utf8");
    expect(appSource).not.toMatch(/<Modal\b/);
    expect(screenSource).not.toMatch(/<Modal\b|BottomSheet/);
    expect(appSource).toMatch(/onBack=\{\(\) => setPreviewKind\(null\)\}/);
  });
});
