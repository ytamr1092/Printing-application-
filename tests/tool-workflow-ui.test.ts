import React, { useState } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { moveWorkflowItem } from "../shared/workflow-files";
import { movePage } from "../shared/pdf-pages";

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
    useWindowDimensions: () => ({ width: (globalThis as any).__workflowWidth ?? 390, height: 800, scale: 1, fontScale: 1 }),
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

import { PageGridEditor } from "../components/page-grid-editor";
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
  it("opens a titled full-screen tool and returns to the previous screen", () => {
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

    const back = renderer.root.findByProps({ accessibilityLabel: "رجوع" });
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
    (globalThis as any).__workflowWidth = width;
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
    expect(JSON.stringify(renderer.root.findByProps({ testID: "workflow-columns" }).props.style)).toContain("column");
    expect(readText(renderer)).toContain(title);
    expect(renderer.root.findByProps({ testID: "tool-workflow-screen" })).toBeTruthy();
    (globalThis as any).__workflowWidth = 390;
  });

  it("places editing beside the single preview panel on wide screens", () => {
    (globalThis as any).__workflowWidth = 1024;
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, workflowProps(true)));
    });
    const columns = renderer.root.findByProps({ testID: "workflow-columns" });
    expect(JSON.stringify(columns.props.style)).toContain("row-reverse");
    expect(columns.findByProps({ testID: "workflow-editor-pane" })).toBeTruthy();
    expect(columns.findByProps({ testID: "workflow-preview-pane" })).toBeTruthy();
    expect(renderer.root.findAllByType("div").filter((node: ReactTestInstance) => node.props.testID === "workflow-preview-pane")).toHaveLength(1);
    (globalThis as any).__workflowWidth = 390;
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
    expect(dragHandle.props.onStartShouldSetPanResponder()).toBe(true);
    expect(dragHandle.props.onPanResponderTerminationRequest()).toBe(false);
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

  it("uses dragged file order for the action that creates the output", () => {
    const actionOrders: string[][] = [];
    function ReorderHarness() {
      const [files, setFiles] = useState([firstFile, secondFile]);
      const props = workflowProps(true);
      return React.createElement(ToolWorkflowScreen, {
        ...props,
        files,
        previewFile: files[0],
        onMoveFile: (from: number, to: number) => setFiles((current) => moveWorkflowItem(current, from, to)),
        onRun: () => actionOrders.push(files.map((file) => file.name)),
      });
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ReorderHarness));
    });
    const dragHandle = renderer.root.findAllByProps({ accessibilityLabel: "اسحب لتحريك الملف" })[0];
    act(() => {
      dragHandle.props.onPanResponderGrant();
      dragHandle.props.onPanResponderMove({}, { dy: 50 });
    });
    expect(readText(renderer).indexOf("appendix.pdf")).toBeLessThan(readText(renderer).indexOf("contract.pdf"));
    const run = renderer.root.findAllByType("button").find((button: ReactTestInstance) => button.findAllByType("span").some((child) => child.children.includes("دمج الملفات")));
    expect(run).toBeTruthy();
    act(() => (run!.props.onClick ?? run!.props.onPress)());
    expect(actionOrders).toEqual([["appendix.pdf", "contract.pdf"]]);
  });

  it("shows every selected image in the one dedicated preview area", () => {
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
    expect(renderer.root.findAllByProps({ accessibilityLabel: "معاينة الصورة 1: one.jpg" }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ accessibilityLabel: "معاينة الصورة 2: two.png" }).length).toBeGreaterThan(0);
    expect(renderer.root.findByProps({ testID: "workflow-preview-pane" })).toBeTruthy();
  });

  it("keeps page drag controls inside the same editor and sends movement to page state", () => {
    const props = {
      ...workflowProps(true),
      kind: "pages" as const,
      files: [{ ...firstFile }],
      previewFile: firstFile,
      pageEdits: [
        { sourcePage: 1, rotation: 0 as const },
        { sourcePage: 2, rotation: 0 as const },
      ],
      onMovePage: vi.fn(),
    };
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    expect(renderer.root.findByProps({ testID: "workflow-page-editor" })).toBeTruthy();
    const dragHandle = renderer.root.findAllByProps({ accessibilityLabel: "اسحب المقبض لتحريك الصفحة" })[0];
    act(() => {
      dragHandle.props.onPanResponderGrant();
      dragHandle.props.onPanResponderMove({}, { dy: 35 });
    });
    expect(props.onMovePage).toHaveBeenCalledWith(1, 1);
  });

  it("uses the dragged page order when the edited PDF is saved", () => {
    const outputOrders: number[][] = [];
    function PageOrderHarness() {
      const [pageEdits, setPageEdits] = useState([
        { sourcePage: 1, rotation: 0 as const },
        { sourcePage: 2, rotation: 0 as const },
      ]);
      const [pageOrder, setPageOrder] = useState("1, 2");
      const props = workflowProps(true);
      const move = (sourcePage: number, direction: -1 | 1) => {
        const from = pageEdits.findIndex((page) => page.sourcePage === sourcePage);
        const next = movePage(pageEdits, from, from + direction);
        setPageEdits(next);
        setPageOrder(next.map((page) => String(page.sourcePage)).join(", "));
      };
      return React.createElement(ToolWorkflowScreen, {
        ...props,
        kind: "pages",
        files: [firstFile],
        previewFile: firstFile,
        pageEdits,
        onMovePage: move,
        onRun: () => outputOrders.push(pageEdits.map((page) => page.sourcePage)),
        settings: { pageOrder },
      });
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(PageOrderHarness));
    });
    const dragHandle = renderer.root.findAllByProps({ accessibilityLabel: "اسحب المقبض لتحريك الصفحة" })[0];
    act(() => {
      dragHandle.props.onPanResponderGrant();
      dragHandle.props.onPanResponderMove({}, { dy: 35 });
    });
    const run = renderer.root.findAllByType("button").find((button: ReactTestInstance) => button.findAllByType("span").some((child) => child.children.includes("إنشاء الملف المعدّل")));
    expect(run).toBeTruthy();
    act(() => (run!.props.onClick ?? run!.props.onPress)());
    expect(outputOrders).toEqual([[2, 1]]);
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
    expect(appSource).toMatch(/hardwareBackPress[\s\S]*?if \(previewKind\)[\s\S]*?closeTool\(\)[\s\S]*?if \(workspace !== "home"\)[\s\S]*?setWorkspace\("home"\)[\s\S]*?return false/);
    expect(appSource).toContain("keyboardDidShow");
    expect(appSource).toContain("automaticallyAdjustKeyboardInsets");
    expect(screenSource).toContain('keyboardShouldPersistTaps="handled"');
    expect(screenSource).toContain("workflowScroll: { flex: 1, minHeight: 0 }");
    expect(appSource).not.toContain("PdfPageTile");
    expect(appSource).not.toContain("styles.pdfPagesList");
    expect(screenSource.match(/<PdfDocumentPreview/g)).toHaveLength(1);
  });

  it("contains no modal or bottom-sheet component in the tool navigation path", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const screenSource = readFileSync(path.resolve(process.cwd(), "components/tool-workflow-screen.tsx"), "utf8");
    expect(appSource).not.toMatch(/<Modal\b/);
    expect(screenSource).not.toMatch(/<Modal\b|BottomSheet/);
    expect(appSource).toContain("onBack={closeTool}");
  });
});

describe("tool workflow UI: selection, zoom and drag-only ordering", () => {
  const imageFiles = [
    { uri: "file:///one.jpg", name: "one.jpg", mimeType: "image/jpeg" },
    { uri: "file:///two.png", name: "two.png", mimeType: "image/png" },
  ];
  const imageProps = () => ({
    ...workflowProps(true),
    kind: "images" as const,
    files: imageFiles,
    previewFile: imageFiles[0],
    onRotateAllFiles: vi.fn(),
    onRotateSelectedFiles: vi.fn(),
  });
  const press = (node: ReactTestInstance) => (node.props.onClick ?? node.props.onPress)();

  it("rotates only the checked images together", () => {
    const props = imageProps();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: "تحديد الصورة" }).length).toBeGreaterThan(0);

    const checkboxes = renderer.root.findAllByProps({ accessibilityLabel: "تحديد الصورة" }).filter((node) => node.type === "button");
    act(() => press(checkboxes[1]));
    const rotateSelected = renderer.root.findAllByProps({ accessibilityLabel: "تدوير الصور المحددة" }).filter((node) => node.type === "button")[0];
    act(() => press(rotateSelected));
    expect(props.onRotateSelectedFiles).toHaveBeenCalledWith(["file:///two.png"]);
  });

  it("selects every image at once and rotates the whole selection", () => {
    const props = imageProps();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    const selectAll = renderer.root.findAllByProps({ accessibilityLabel: "تحديد كل الصور" }).filter((node) => node.type === "button")[0];
    act(() => press(selectAll));
    const rotateSelected = renderer.root.findAllByProps({ accessibilityLabel: "تدوير الصور المحددة" }).filter((node) => node.type === "button")[0];
    act(() => press(rotateSelected));
    expect(props.onRotateSelectedFiles).toHaveBeenCalledWith(["file:///one.jpg", "file:///two.png"]);
  });

  it("zooms the image preview in and back to fit", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, imageProps()));
    });
    expect(readText(renderer)).toContain("100%");
    const zoomIn = renderer.root.findAllByProps({ accessibilityLabel: "تكبير" }).filter((node) => node.type === "button")[0];
    act(() => press(zoomIn));
    expect(readText(renderer)).toContain("150%");
    const fit = renderer.root.findAllByProps({ accessibilityLabel: "ملاءمة العرض" }).filter((node) => node.type === "button")[0];
    act(() => press(fit));
    expect(readText(renderer)).toContain("100%");
  });

  it("orders files by dragging only, without up/down arrow buttons", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, imageProps()));
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: "تحريك لأعلى" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ accessibilityLabel: "تحريك لأسفل" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ accessibilityLabel: "اسحب لتحريك الملف" }).length).toBeGreaterThan(0);
  });
});

describe("tool workflow UI: separate save and share, isolated tools", () => {
  const press = (node: ReactTestInstance) => (node.props.onClick ?? node.props.onPress)();
  const resultProps = () => ({
    ...workflowProps(true),
    result: { title: "تم الدمج", uri: "file:///out/merged.pdf", mimeType: "application/pdf" },
    onSaveResult: vi.fn(),
    onShareResult: vi.fn(),
  });

  it("offers a Save button and a Share button that do different things", () => {
    const props = resultProps();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    const save = renderer.root.findAllByProps({ accessibilityLabel: "حفظ على الجهاز" }).filter((node) => node.type === "button")[0];
    const share = renderer.root.findAllByProps({ accessibilityLabel: "مشاركة" }).filter((node) => node.type === "button")[0];
    expect(save).toBeTruthy();
    expect(share).toBeTruthy();
    act(() => press(save));
    expect(props.onSaveResult).toHaveBeenCalledTimes(1);
    expect(props.onShareResult).not.toHaveBeenCalled();
    act(() => press(share));
    expect(props.onShareResult).toHaveBeenCalledTimes(1);
    expect(props.onSaveResult).toHaveBeenCalledTimes(1);
  });

  it("shows neither button before a result exists", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, { ...workflowProps(true), onSaveResult: vi.fn() }));
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: "حفظ على الجهاز" })).toHaveLength(0);
  });

  it("clears each tool's files, preview and results when leaving it, and asks twice before exiting", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const closeStart = appSource.indexOf("const closeTool = () => {");
    const closeSource = appSource.slice(closeStart, appSource.indexOf("useEffect(", closeStart));
    for (const call of [
      "setPreviewKind(null)",
      "setPendingAssets([])",
      "setPreviewAsset(null)",
      "setExtractFile(null)",
      "setNumberingFile(null)",
      "setPageEditorFile(null)",
      "setPrintAsset(null)",
      "setIdFrontUri(null)",
      "setIdBackUri(null)",
      "setCutFile(null)",
      "setCropPreview(null)",
      "setToolResults({})",
    ]) {
      expect(closeSource).toContain(call);
    }
    expect(appSource).toContain("onBack={closeTool}");
    expect(appSource).not.toMatch(/onBack=\{\(\) => setPreviewKind\(null\)\}/);
    const backStart = appSource.indexOf('"hardwareBackPress"');
    const backSource = appSource.slice(backStart, backStart + 900);
    expect(backSource).toContain("closeTool()");
    expect(backSource).toContain("ToastAndroid.show(t.pressBackAgain");
    expect(backSource).toContain("< 2000");
  });
});

describe("tool workflow UI: drag from anywhere and the cut tool", () => {
  const press = (node: ReactTestInstance) => (node.props.onClick ?? node.props.onPress)();
  const touch = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y } });

  it("lets a file row be dragged from anywhere after a press-and-hold", () => {
    vi.useFakeTimers();
    try {
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
      const row = renderer.root.findAllByProps({ testID: "workflow-file-row-0" })[0];

      // Moving the finger before the hold finishes is a scroll, not a drag.
      act(() => row.props.onTouchStart(touch(10, 10)));
      act(() => row.props.onTouchMove(touch(10, 60)));
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(row.props.onMoveShouldSetPanResponder()).toBe(false);
      act(() => row.props.onTouchEnd());

      // Holding still arms the drag; then the row claims the gesture and moves.
      act(() => row.props.onTouchStart(touch(10, 10)));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(row.props.onMoveShouldSetPanResponder()).toBe(true);
      expect(row.props.onMoveShouldSetPanResponderCapture()).toBe(true);
      expect(row.props.onStartShouldSetPanResponder()).toBe(false);
      act(() => {
        row.props.onPanResponderGrant();
        row.props.onPanResponderMove({}, { dy: 70 });
      });
      expect(props.onMoveFile).toHaveBeenCalledWith(0, 1);
      act(() => row.props.onPanResponderRelease());
      expect(row.props.onMoveShouldSetPanResponder()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  const cutProps = (mode: "split" | "crop") => ({
    ...workflowProps(true),
    kind: "cut" as const,
    title: "قص ملف PDF",
    files: [firstFile],
    previewFile: firstFile,
    pageCount: 6,
    settings: { cutMode: mode, cutRanges: "1-3, 4-6", cropScope: "page" },
    onSettingChange: vi.fn(),
    onCropRectChange: vi.fn(),
    onCropPageChange: vi.fn(),
    cropPreview: { uri: null, aspect: 0.75 },
  });

  it("shows how many files a split will create and the one-file-per-page shortcut", () => {
    const props = cutProps("split");
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    expect(readText(renderer)).toContain("سيتم إنشاء 2 ملف");
    const each = renderer.root.findAllByProps({ accessibilityLabel: "كل صفحة في ملف مستقل" }).filter((node) => node.type === "button")[0];
    act(() => press(each));
    expect(props.onSettingChange).toHaveBeenCalledWith("cutRanges", "1, 2, 3, 4, 5, 6");
    expect(readText(renderer)).toContain("قص الملف");
  });

  it("flags invalid split ranges", () => {
    const props = { ...cutProps("split"), settings: { cutMode: "split", cutRanges: "1-9" } };
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    expect(readText(renderer)).toContain("اكتب نطاقات صحيحة");
  });

  it("crop mode lets the frame move from anywhere inside it and be redrawn from anywhere", () => {
    const props = { ...cutProps("crop"), cropRect: { x: 0.2, y: 0.2, w: 0.4, h: 0.4 } };
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    // The editor measures itself; give it a width so the page and frame render.
    const editor = renderer.root.findAllByProps({ testID: "crop-editor" })[0];
    act(() => editor.props.onLayout({ nativeEvent: { layout: { width: 300 } } }));
    const body = renderer.root.findAllByProps({ testID: "crop-selection-body" })[0];
    expect(body.props.onStartShouldSetPanResponder()).toBe(true);
    act(() => {
      body.props.onPanResponderGrant();
      body.props.onPanResponderMove({}, { dx: 30, dy: 0 });
    });
    expect(props.onCropRectChange).toHaveBeenCalled();
    const moved = props.onCropRectChange.mock.calls.at(-1)![0];
    expect(moved.x).toBeGreaterThan(0.2);
    expect(moved.w).toBeCloseTo(0.4, 6);

    const corner = renderer.root.findAllByProps({ testID: "crop-handle-br" })[0];
    act(() => {
      corner.props.onPanResponderGrant();
      corner.props.onPanResponderMove({}, { dx: 30, dy: 30 });
    });
    const resized = props.onCropRectChange.mock.calls.at(-1)![0];
    expect(resized.x).toBeCloseTo(0.2, 6);
    expect(resized.w).toBeGreaterThan(0.4);

    const page = renderer.root.findAllByProps({ accessibilityLabel: "منطقة القص" }).find((node) => typeof node.props.onPanResponderGrant === "function")!;
    act(() => {
      page.props.onPanResponderGrant({ nativeEvent: { locationX: 30, locationY: 40 } });
      page.props.onPanResponderMove({}, { dx: 90, dy: 80 });
    });
    const drawn = props.onCropRectChange.mock.calls.at(-1)![0];
    expect(drawn.x).toBeCloseTo(0.1, 6);
    expect(drawn.w).toBeCloseTo(0.3, 6);
  });

  it("crop mode offers whole-page reset, page navigation and a sensitive-data note", () => {
    const props = cutProps("crop");
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    const whole = renderer.root.findAllByProps({ accessibilityLabel: "تحديد الصفحة كلها" }).filter((node) => node.type === "button")[0];
    act(() => press(whole));
    expect(props.onCropRectChange).toHaveBeenCalledWith({ x: 0, y: 0, w: 1, h: 1 });
    const next = renderer.root.findAllByProps({ accessibilityLabel: "الصفحة التالية" }).filter((node) => node.type === "button")[0];
    act(() => press(next));
    expect(props.onCropPageChange).toHaveBeenCalledWith(1);
    expect(readText(renderer)).toContain("الصفحة 1 من 6");
    expect(readText(renderer)).toContain("تبقى داخل الملف");
  });

  it("hides Share when a result has several files and points to Save", () => {
    const props = {
      ...cutProps("split"),
      result: { title: "تم", uri: "file:///a.pdf", uris: ["file:///a.pdf", "file:///b.pdf"], mimeType: "application/pdf" },
      onSaveResult: vi.fn(),
    };
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, props));
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: "مشاركة" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ accessibilityLabel: "حفظ على الجهاز" }).length).toBeGreaterThan(0);
    expect(readText(renderer)).toContain("حفظ على الجهاز");
  });
});

describe("page grid window", () => {
  const press = (node: ReactTestInstance) => (node.props.onClick ?? node.props.onPress)();
  const touch = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y } });
  const items = ["a", "b", "c", "d"].map((key, index) => ({
    key,
    label: String(index + 1),
    thumbUri: key === "a" ? "file:///thumb-a.png" : null,
    rotation: key === "c" ? 90 : 0,
  }));
  const gridProps = (overrides: Record<string, unknown> = {}) => ({
    title: "معاينة ترتيب صفحات PDF",
    items,
    selected: [] as string[],
    isArabic: true,
    onToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    onMove: vi.fn(),
    onRotateSelected: vi.fn(),
    onDeleteSelected: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  });
  const render = (props: ReturnType<typeof gridProps>) => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(PageGridEditor, props));
    });
    return renderer;
  };
  const buttonByLabel = (renderer: ReactTestRenderer, label: string) =>
    renderer.root.findAllByProps({ accessibilityLabel: label }).filter((node) => node.type === "button")[0];

  it("shows every page and how many are selected", () => {
    const renderer = render(gridProps({ selected: ["b"] }));
    expect(renderer.root.findAllByProps({ testID: "page-grid-editor" }).length).toBeGreaterThan(0);
    for (let i = 0; i < items.length; i += 1) {
      expect(renderer.root.findAllByProps({ testID: `grid-cell-${i}` }).length).toBeGreaterThan(0);
    }
    expect(readText(renderer)).toContain("تم تحديد 1 من 4 من الصفحات");
    expect(renderer.root.findAllByType("img").some((node: ReactTestInstance) => node.props.source?.uri === "file:///thumb-a.png")).toBe(true);
  });

  it("selects a page with a tap and offers select all / clear", () => {
    const props = gridProps();
    const renderer = render(props);
    act(() => press(buttonByLabel(renderer, "الصفحة 2")));
    expect(props.onToggle).toHaveBeenCalledWith("b");
    act(() => press(buttonByLabel(renderer, "تحديد الكل")));
    expect(props.onSelectAll).toHaveBeenCalled();

    const all = gridProps({ selected: ["a", "b", "c", "d"] });
    const full = render(all);
    act(() => press(buttonByLabel(full, "إلغاء تحديد الكل")));
    expect(all.onClear).toHaveBeenCalled();
  });

  it("disables the actions until something is selected, then runs them", () => {
    const empty = render(gridProps());
    expect(buttonByLabel(empty, "حذف").props.disabled).toBe(true);
    expect(buttonByLabel(empty, "تدوير").props.disabled).toBe(true);

    const props = gridProps({ selected: ["a", "b"], onExtractSelected: vi.fn() });
    const renderer = render(props);
    act(() => press(buttonByLabel(renderer, "حذف")));
    act(() => press(buttonByLabel(renderer, "تدوير")));
    act(() => press(buttonByLabel(renderer, "استخراج")));
    expect(props.onDeleteSelected).toHaveBeenCalledTimes(1);
    expect(props.onRotateSelected).toHaveBeenCalledTimes(1);
    expect(props.onExtractSelected).toHaveBeenCalledTimes(1);
    expect(buttonByLabel(empty, "استخراج")).toBeUndefined();
  });

  it("reorders by press-and-hold then dragging a page across the grid", () => {
    vi.useFakeTimers();
    try {
      const props = gridProps({ isArabic: false });
      const renderer = render(props);
      const cell = renderer.root.findAllByProps({ testID: "grid-cell-0" })[0];

      // A quick tap never arms the drag.
      act(() => cell.props.onTouchStart(touch(5, 5)));
      act(() => cell.props.onTouchEnd());
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(cell.props.onMoveShouldSetPanResponder()).toBe(false);

      // Hold, then drag one column right and one row down (two columns, 195px wide).
      act(() => cell.props.onTouchStart(touch(5, 5)));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(cell.props.onMoveShouldSetPanResponder()).toBe(true);
      act(() => {
        cell.props.onPanResponderGrant();
        cell.props.onPanResponderMove({}, { dx: 200, dy: 0 });
      });
      expect(props.onMove).toHaveBeenCalledWith(0, 1);
      act(() => {
        cell.props.onPanResponderMove({}, { dx: 200, dy: 310 });
      });
      expect(props.onMove).toHaveBeenLastCalledWith(0, 3);
      act(() => cell.props.onPanResponderRelease());
      expect(cell.props.onMoveShouldSetPanResponder()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("mirrors horizontal drags in the right-to-left layout", () => {
    vi.useFakeTimers();
    try {
      const props = gridProps({ isArabic: true });
      const renderer = render(props);
      const cell = renderer.root.findAllByProps({ testID: "grid-cell-0" })[0];
      act(() => cell.props.onTouchStart(touch(5, 5)));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      act(() => {
        cell.props.onPanResponderGrant();
        // In Arabic the first page is on the right, so the next one is to its left.
        cell.props.onPanResponderMove({}, { dx: -200, dy: 0 });
      });
      expect(props.onMove).toHaveBeenCalledWith(0, 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is opened from the preview for images and pages, and closes back", () => {
    const open = vi.fn();
    const images = [
      { uri: "file:///one.jpg", name: "one.jpg", mimeType: "image/jpeg" },
      { uri: "file:///two.png", name: "two.png", mimeType: "image/png" },
    ];
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(ToolWorkflowScreen, { ...workflowProps(true), kind: "images" as const, files: images, previewFile: images[0], onOpenPageGrid: open }));
    });
    act(() => press(buttonByLabel(renderer, "عرض كل الصور وتعديلها")));
    expect(open).toHaveBeenCalledTimes(1);

    let pages!: ReactTestRenderer;
    act(() => {
      pages = create(React.createElement(ToolWorkflowScreen, { ...workflowProps(true), kind: "pages" as const, files: [firstFile], previewFile: firstFile, pageEdits: [{ sourcePage: 1, rotation: 0 as const }], onOpenPageGrid: open }));
    });
    expect(pages.root.findAllByProps({ accessibilityLabel: "عرض كل الصفحات وتعديلها" }).length).toBeGreaterThan(0);
    let merge!: ReactTestRenderer;
    act(() => {
      merge = create(React.createElement(ToolWorkflowScreen, { ...workflowProps(true), onOpenPageGrid: open }));
    });
    expect(merge.root.findAllByProps({ accessibilityLabel: "عرض كل الصفحات وتعديلها" })).toHaveLength(0);

    const props = gridProps();
    const grid = render(props);
    act(() => press(buttonByLabel(grid, "إغلاق نافذة الصفحات")));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("is wired into the app: the phone back button closes the window before the tool", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    expect(appSource).toContain("<PageGridEditor");
    expect(appSource).toContain("onOpenPageGrid=");
    const backStart = appSource.indexOf('"hardwareBackPress"');
    const backSource = appSource.slice(backStart, backStart + 1400);
    expect(backSource.indexOf("pageGridOpen")).toBeGreaterThan(-1);
    expect(backSource.indexOf("pageGridOpen")).toBeLessThan(backSource.indexOf("closeTool()"));
    expect(backSource).toContain("< 2000");
    expect(appSource).toContain("setPageGridOpen(false);\n    setGridSelected([]);\n    setPageThumbs({});");
  });
});
