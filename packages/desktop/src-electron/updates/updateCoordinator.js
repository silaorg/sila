import { updateStrategy } from './updateStrategy.js';

/**
 * Update Coordinator - Manages coordination between different update systems
 * Prevents conflicts between full app updates and client bundle updates
 * Uses smart strategy to determine which update mechanism to use
 */
export class UpdateCoordinator {
  constructor() {
    this.fullAppUpdate = false;
    this.clientBundleUpdate = false;
    this.dialogShown = false;
    this.currentVersion = null;
  }

  /**
   * Set full app update state
   * @param {boolean} updating - Whether full app update is in progress
   */
  setFullAppUpdate(updating) {
    this.fullAppUpdate = updating;
    console.log(`Full app update state: ${updating}`);
  }

  /**
   * Set client bundle update state
   * @param {boolean} updating - Whether client bundle update is in progress
   */
  setClientBundleUpdate(updating) {
    this.clientBundleUpdate = updating;
    console.log(`Client bundle update state: ${updating}`);
  }

  /**
   * Check if client bundle updates can be checked
   * @returns {boolean} - True if client updates can be checked
   */
  canCheckClientUpdates() {
    return !this.fullAppUpdate;
  }


  /**
   * Set current app version
   * @param {string} version - Current app version
   */
  setCurrentVersion(version) {
    this.currentVersion = version;
  }
}

// Create singleton instance
export const updateCoordinator = new UpdateCoordinator();