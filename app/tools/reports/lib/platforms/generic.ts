import type { PlatformProfile } from "../types";

export const genericProfile: PlatformProfile = {
  id: "generic",
  name: "Generic CSV",
  detect: () => true, // Always matches as fallback
  columnMap: {
    // Generic uses fuzzy matching via suggestMappings() in platforms.ts
    // This map is intentionally sparse — the ColumnMapper UI handles the rest
  },
};
