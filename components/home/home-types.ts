import { type CropRect } from "@/shared/pdf-cut";
import { type WorkspaceKind } from "@/shared/workspaces";

export type Language = "ar" | "en";
export type NumberPosition = "left" | "center" | "right";
export type NumberVertical = "top" | "middle" | "bottom";
export type NumberWhich = "all" | "odd" | "even";
export type NumberNumerals = "latin" | "indic" | "roman-l" | "roman-u";
export type Workspace = WorkspaceKind;
export type PickedAsset = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  rotation?: number;
};
export type DeviceTaskStatus = "connecting" | "in-progress" | "completed" | "failed" | "canceled" | "awaiting-confirmation";
export type OperationProgress = { label: string; stage: 1 | 2 | 3; complete?: boolean; deviceState?: DeviceTaskStatus; deviceTask?: boolean; hint?: string };
export type CutFile = {
  uri: string;
  name: string;
  pages: number;
  sizes: { width: number; height: number; rotation: number }[];
};
export const INITIAL_CROP_RECT: CropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

