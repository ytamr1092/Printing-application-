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
    KeyboardAvoidingView: host("div"),
    PanResponder: { create: (handlers: Record<string, unknown>) => ({ panHandlers: handlers }) },
    Platform: { OS: "android" },
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
  frontRotation: 0,
  backRotation: 0,
  settings: {},
  result: null,
  error: null,
  processing: false,
  idBusy: false,
  canRun: true,
  onBack: vi.fn(),
  onPickFiles: vi.fn(),
  onPickIdFace: vi.fn(),
  onRotateIdFace: vi.fn(),
  onScanIdFace: vi.fn(),
  onSelectPreviewFile: vi.fn(),
  onMoveFile: vi.fn(),
  onRotateFile: vi.fn(),
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
    expect(readText(renderer)).toContain("تصفح الملفات");
    const browseFiles = renderer.root
      .findAllByType("button")
      .find((button: ReactTestInstance) => button.findAllByType("span").some((child) => child.children.includes("تصفح الملفات")));
    expect(browseFiles).toBeTruthy();
    act(() => (browseFiles!.props.onClick ?? browseFiles!.props.onPress)());
    expect(props.onPickIdFace).toHaveBeenCalledWith("front", "files");
  });

  it("supports accessible drag reordering and persistent per-image rotation controls", () => {
    const props = {
      ...workflowProps(true),
      kind: "images" as const,
      files: [
        { uri: "file:///one.jpg", name: "one.jpg", mimeType: "image/jpeg" },
        { uri: "file:///two.png", name: "two.png", mimeType: "image/png" },
      ],
      previewFile: { uri: "file:///one.jpg", name: "one.jpg", mimeType: "image/jpeg" },
    };
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });

    const dragHandle = renderer.root.findAllByProps({ accessibilityLabel: "اسحب لتحريك الملف" })[0];
    act(() => {
      dragHandle.props.onPanResponderGrant();
      dragHandle.props.onPanResponderMove({}, { dy: 50 });
    });
    expect(props.onMoveFile).toHaveBeenCalledWith(0, 1);

    const rotateButton = renderer.root.findAllByProps({ accessibilityLabel: "تدوير الصورة" })[0];
    act(() => (rotateButton.props.onClick ?? rotateButton.props.onPress)());
    expect(props.onRotateFile).toHaveBeenCalledWith(0);

    const galleryButton = renderer.root
      .findAllByType("button")
      .find((button: ReactTestInstance) => button.findAllByType("span").some((child) => child.children.includes("اختيار من المعرض")));
    const filesButton = renderer.root
      .findAllByType("button")
      .find((button: ReactTestInstance) => button.findAllByType("span").some((child) => child.children.includes("تصفح الملفات")));
    act(() => (galleryButton!.props.onClick ?? galleryButton!.props.onPress)());
    act(() => (filesButton!.props.onClick ?? filesButton!.props.onPress)());
    expect(props.onPickFiles).toHaveBeenNthCalledWith(1, "gallery");
    expect(props.onPickFiles).toHaveBeenNthCalledWith(2, "files");
  });

  it("keeps every PDF page reachable with free scrolling and shows the page position", () => {
    const pdfSource = readFileSync(path.resolve(process.cwd(), "components/pdf-document-preview.native.tsx"), "utf8");
    expect(pdfSource).toMatch(/pagingEnabled=\{false\}/);
    expect(pdfSource).toContain("onLoadComplete");
    expect(pdfSource).toContain("onPageChanged");
    expect(pdfSource).toContain("صفحة ${pageIndex + 1} من ${pageCount}");
  });

  it("keeps picker cancellation non-destructive and carries image rotation into generated PDFs", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const selectionStart = appSource.indexOf("const selectFilesFor = async");
    const selectionEnd = appSource.indexOf("const executeMergePdfs", selectionStart);
    const selectionSource = appSource.slice(selectionStart, selectionEnd);
    expect(selectionSource.match(/if \(result\.canceled \|\| !result\.assets\?\.length\) \{\s*setOperationProgress\(null\);\s*return;\s*\}/g)).toHaveLength(2);
    expect(appSource).toContain('class="rotate-${normalizeRotation(asset.rotation)}"');
    expect(appSource).toContain("section.rotate-90 img{transform:rotate(90deg)}");
    expect(appSource).toContain('cards(front, "none", normalizeRotation(idFrontRotation))');
    expect(appSource).toContain("data:${mimeType};base64,${base64}");
  });

  it("keeps Android back inside the app and makes keyboard-covered fields scrollable", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const screenSource = readFileSync(path.resolve(process.cwd(), "components/tool-workflow-screen.tsx"), "utf8");
    expect(appSource).toMatch(/hardwareBackPress[\s\S]*?setPreviewKind\(null\)[\s\S]*?return true/);
    expect(appSource).toContain("if (!previewKind) return;");
    expect(appSource).toContain("keyboardDidShow");
    expect(appSource).toContain("automaticallyAdjustKeyboardInsets");
    expect(screenSource).toContain('keyboardShouldPersistTaps="handled"');
    expect(screenSource).toContain("workflowScroll: { flex: 1, minHeight: 0 }");
  });

  it("contains no modal or bottom-sheet component in the tool navigation path", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const screenSource = readFileSync(path.resolve(process.cwd(), "components/tool-workflow-screen.tsx"), "utf8");
    expect(appSource).not.toMatch(/<Modal\b/);
    expect(screenSource).not.toMatch(/<Modal\b|BottomSheet/);
    expect(appSource).toMatch(/onBack=\{\(\) => setPreviewKind\(null\)\}/);
  });
});
