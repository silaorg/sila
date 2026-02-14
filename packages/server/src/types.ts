import type { User } from "./db";
import { SpaceManager } from "@sila/core";

export type AppVariables = {
  user: User | null;
  spaceManager: SpaceManager;
};
