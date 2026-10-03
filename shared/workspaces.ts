export const workspaceKinds = [
  "home",
  "pdf",
  "print",
  "scan",
  "id",
  "results",
  "ai",
] as const;

export type WorkspaceKind = (typeof workspaceKinds)[number];
