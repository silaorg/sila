import type { AppFileSystem } from "../../appFs";
import type { FileLayer } from "./FileLayer";
import type { FileStoreProvider } from "./FileStore";

/**
 * LocalFileLayer provides local filesystem-based file storage.
 * Used for desktop applications and local-first spaces.
 */
export class LocalFileLayer implements FileLayer {
  readonly id = "local-file-layer";

  constructor(
    private readonly spacePath: string,
    private readonly fs: AppFileSystem,
  ) { }

  getFileStoreProvider(): FileStoreProvider {
    return {
      getSpaceRootPath: () => this.spacePath,
      getFs: () => this.fs,
    };
  }
}
