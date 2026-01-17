import { ClientState, type ClientStateConfig } from "@sila/client";
import { capacitorDialogsWrapper } from "./capacitorDialogsWrapper";
import { capacitorFsWrapper } from "./capacitorFsWrapper";

export function createMobileConfig(): ClientStateConfig {
  return {
    initState: new ClientState(),
    fs: capacitorFsWrapper,
    dialog: capacitorDialogsWrapper
  };
}
