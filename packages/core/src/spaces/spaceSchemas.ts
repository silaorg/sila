import { z } from "zod";

/*
@scratchpad

Everything is an applet or a folder

space itself is an applet

- space (app: "space")
  - user-spaces
    - admin (app: "user-space")
    - dmitry (app: "user-space")
  - settings (app: "space-settings")
  - configs
    - chat
      - assistant-v1 (app: "app-config")
  - threads
    - chat-1 (app: "chat")
    - chat-2 (app: "chat")
    - folder-1 (app: "project")
      - chat-3 (app: "chat")
    - folder-2
      - chat-4 (app: "chat")
  - files (app: "files")

*/

export const TreeRefSchema = z.object({
  name: z.string(),
  appKind: z.string(),
  tid: z.string()
});

export const FolderSchema = z.object({
  name: z.string()
});

export const FolderOrTreeRefSchema = z.union([
  TreeRefSchema,
  FolderSchema,
]);

export const SpaceSchema = z.object({
  name: z.string(),
  configs: z.array(z.string()), // @TODO: come up with how to store it
  folders: z.array(FolderOrTreeRefSchema),
});

export const AppletSchema = z.object({
  name: z.string(),
  app: z.string(),
  version: z.string(),
});