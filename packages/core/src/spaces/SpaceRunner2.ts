import { SyncLayer } from "@sila/core";
import { Space } from "./Space";
import { SpacePointer2 } from "./SpaceManager2";

export class SpaceRunner2 {

  /**
   * Create a new space runner from an existing space that we have in memory
   * @param space 
   * @param pointer 
   * @param layers 
   */
  static fromExistingSpace(space: Space, pointer: SpacePointer2, layers: SyncLayer[]): SpaceRunner2 {
    throw new Error("Not implemented");
  }

  /**
   * Create a new space runner from a pointer. This will load the space from the layers.
   * @param pointer 
   * @param layers 
   */
  static fromPointer(pointer: SpacePointer2, layers: SyncLayer[]): SpaceRunner2 {
    throw new Error("Not implemented");
  }

  private constructor(

  ) {

  }
}