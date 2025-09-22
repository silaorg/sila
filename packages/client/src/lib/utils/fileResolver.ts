import { useClientState } from '../state/clientStateContext';
import { FileResolver, type ResolvedFileInfo, type FileReference } from '@sila/core';

export { type ResolvedFileInfo, type FileReference };

/**
 * Extracts file references from a message object
 */
export function extractFileReferences(message: any): FileReference[] {
  if (!message || !message.files || !Array.isArray(message.files)) {
    return [];
  }

  return message.files as FileReference[];
}

export class ClientFileResolver {
  /**
   * Resolves a file reference to file information using the current space state
   */
  static async resolveFileReference(fileRef: FileReference): Promise<ResolvedFileInfo | null> {
    const clientState = useClientState();
    if (!clientState.currentSpace) {
      console.warn('No current space available for file resolution');
      return null;
    }

    const fileResolver = new FileResolver(clientState.currentSpace);
    return await fileResolver.resolveFileReference(fileRef);
  }

  /**
   * Resolves multiple file references
   */
  static async getFilesInfo(fileRefs: FileReference[]): Promise<ResolvedFileInfo[]> {
    const clientState = useClientState();
    if (!clientState.currentSpace) {
      console.warn('No current space available for file resolution');
      return [];
    }

    const fileResolver = new FileResolver(clientState.currentSpace);
    return await fileResolver.getFilesInfo(fileRefs);
  }
}