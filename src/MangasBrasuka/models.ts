import type { Tag } from "@paperback/types";

export const MODE_OPTIONS: Tag[] = [
  { id: "include", title: "Include" },
  { id: "exclude", title: "Exclude" },
];

export type ContentTemplateSearchMetadata = {
  mode?: "include" | "exclude";
};
