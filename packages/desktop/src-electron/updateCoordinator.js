/**
 * Update Coordinator - Manages coordination between different update systems
 * Prevents conflicts between full app updates and client bundle updates
 */
export class UpdateCoordinator {
  constructor() {
    this.fullAppUpdate = false;
    this.clientBundleUpdate = false;
    this.dialogShown = false;
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
   * Get current update state
   * @returns {Object} - Current update state
   */
  getState() {
    return {
      fullAppUpdate: this.fullAppUpdate,
      clientBundleUpdate: this.clientBundleUpdate,
      dialogShown: this.dialogShown
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