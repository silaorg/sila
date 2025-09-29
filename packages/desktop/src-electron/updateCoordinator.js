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
    this.updateStrategy = null;
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
   * Check if any update dialog can be shown
   * @returns {boolean} - True if dialog can be shown
   */
  canShowDialog() {
    return !this.dialogShown;
  }

  /**
   * Set dialog shown state
   * @param {boolean} shown - Whether a dialog is currently shown
   */
  setDialogShown(shown) {
    this.dialogShown = shown;
    console.log(`Dialog shown state: ${shown}`);
  }

  /**
   * Set current app version
   * @param {string} version - Current app version
   */
  setCurrentVersion(version) {
    this.currentVersion = version;
  }

  /**
   * Determine update strategy based on available versions
   * @param {string} latestFullAppVersion - Latest full app version
   * @param {string} latestClientBundleVersion - Latest client bundle version
   * @returns {Object | null} Update strategy recommendation
   */
  determineUpdateStrategy(latestFullAppVersion, latestClientBundleVersion) {
    if (!this.currentVersion) {
      console.warn('Current version not set, cannot determine update strategy');
      return null;
    }

    this.updateStrategy = updateStrategy.determineUpdateStrategy(
      this.currentVersion,
      latestFullAppVersion,
      latestClientBundleVersion
    );

    console.log('Update strategy determined:', this.updateStrategy);
    return this.updateStrategy;
  }

  /**
   * Get current update state
   * @returns {Object} - Current update state
   */
  getState() {
    return {
      fullAppUpdate: this.fullAppUpdate,
      clientBundleUpdate: this.clientBundleUpdate,
      dialogShown: this.dialogShown,
      updateStrategy: this.updateStrategy,
      currentVersion: this.currentVersion
    };
  }

  /**
   * Reset all update states
   */
  reset() {
    this.fullAppUpdate = false;
    this.clientBundleUpdate = false;
    this.dialogShown = false;
    console.log('Update coordinator reset');
  }
}

// Create singleton instance
export const updateCoordinator = new UpdateCoordinator();