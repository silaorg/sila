import type { BuiltInLangTool, LangToolWithHandler } from "aiwrapper";
import type { AgentServices } from "../AgentServices";
import type { AppTree } from "../../spaces/AppTree";

export interface AgentTool {
  name: string;
  instructions?: string;
  description?: string;
  parameters?: LangToolWithHandler["parameters"];
  canUseTool?: (services: AgentServices, appTree: AppTree) => boolean;
  getTool(
    this: AgentTool,
    services: AgentServices,
    appTree: AppTree
  ): LangToolWithHandler | BuiltInLangTool;
}
