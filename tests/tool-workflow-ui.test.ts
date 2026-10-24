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
    expect(appSource).toMatch(/hardwareBackPress[\s\S]*?if \(previewKind\)[\s\S]*?setPreviewKind\(null\)[\s\S]*?if \(workspace !== "home"\)[\s\S]*?setWorkspace\("home"\)[\s\S]*?return false/);
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
