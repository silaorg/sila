/**
 * Update Strategy - Determines which update mechanism to use based on version differences
 * Logic: Use client bundle updates for patch/minor versions, full app updates for major versions
 */
export class UpdateStrategy {
  constructor() {
    this.currentVersion = null;
    this.latestFullAppVersion = null;
    this.latestClientBundleVersion = null;
  }

  /**
   * Parse version string into semantic version object
   * @param {string} version - Version string (e.g., "1.2.3")
   * @returns {Object} Parsed version object
   */
  parseVersion(version) {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
      original: version
    };
  }

  /**
   * Compare two versions
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
   */
  compareVersions(version1, version2) {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);

    if (v1.major !== v2.major) return v1.major - v2.major;
    if (v1.minor !== v2.minor) return v1.minor - v2.minor;
    return v1.patch - v2.patch;
  }

  /**
   * Check if version difference is major
   * @param {string} currentVersion - Current version
   * @param {string} latestVersion - Latest version
   * @returns {boolean} True if major version difference
   */
  isMajorVersionDifference(currentVersion, latestVersion) {
    const current = this.parseVersion(currentVersion);
    const latest = this.parseVersion(latestVersion);
    return current.major !== latest.major;
  }

  /**
   * Check if version difference is minor or patch
   * @param {string} currentVersion - Current version
   * @param {string} latestVersion - Latest version
   * @returns {boolean} True if minor or patch version difference
   */
  isMinorOrPatchDifference(currentVersion, latestVersion) {
    const current = this.parseVersion(currentVersion);
    const latest = this.parseVersion(latestVersion);
    
    // Same major version, but different minor or patch
    return current.major === latest.major && 
           (current.minor !== latest.minor || current.patch !== latest.patch);
  }

  /**
   * Determine update strategy based on version differences
   * @param {string} currentVersion - Current app version
   * @param {string} latestFullAppVersion - Latest full app version
   * @param {string} latestClientBundleVersion - Latest client bundle version
   * @returns {Object} Update strategy recommendation
   */
  determineUpdateStrategy(currentVersion, latestFullAppVersion, latestClientBundleVersion) {
    this.currentVersion = currentVersion;
    this.latestFullAppVersion = latestFullAppVersion;
    this.latestClientBundleVersion = latestClientBundleVersion;

    const strategy = {
      useFullAppUpdate: false,
      useClientBundleUpdate: false,
      reason: '',
      priority: 'none'
    };

    // If no versions available, no updates
    if (!latestFullAppVersion && !latestClientBundleVersion) {
      strategy.reason = 'No updates available';
      return strategy;
    }

    // If only client bundle version available, use it
    if (!latestFullAppVersion && latestClientBundleVersion) {
      strategy.useClientBundleUpdate = true;
      strategy.reason = 'Only client bundle update available';
      strategy.priority = 'client';
      return strategy;
    }

    // If only full app version available, use it
    if (latestFullAppVersion && !latestClientBundleVersion) {
      strategy.useFullAppUpdate = true;
      strategy.reason = 'Only full app update available';
      strategy.priority = 'full';
      return strategy;
    }

    // Both versions available - determine strategy
    const current = this.parseVersion(currentVersion);
    const fullApp = this.parseVersion(latestFullAppVersion);
    const clientBundle = this.parseVersion(latestClientBundleVersion);

    // If full app is newer and has major version difference, use full app
    if (this.compareVersions(latestFullAppVersion, currentVersion) > 0) {
      if (this.isMajorVersionDifference(currentVersion, latestFullAppVersion)) {
        strategy.useFullAppUpdate = true;
        strategy.reason = `Major version update available: ${currentVersion} → ${latestFullAppVersion}`;
        strategy.priority = 'full';
        return strategy;
      }
    }

    // If client bundle is newer and full app is same major version, use client bundle
    if (this.compareVersions(latestClientBundleVersion, currentVersion) > 0) {
      if (this.isMinorOrPatchDifference(currentVersion, latestClientBundleVersion)) {
        strategy.useClientBundleUpdate = true;
        strategy.reason = `Minor/patch update available: ${currentVersion} → ${latestClientBundleVersion}`;
        strategy.priority = 'client';
        return strategy;
      }
    }

    // If both are newer, prefer the one with higher version
    if (this.compareVersions(latestFullAppVersion, currentVersion) > 0 && 
        this.compareVersions(latestClientBundleVersion, currentVersion) > 0) {
      
      if (this.compareVersions(latestFullAppVersion, latestClientBundleVersion) >= 0) {
        if (this.isMajorVersionDifference(currentVersion, latestFullAppVersion)) {
          strategy.useFullAppUpdate = true;
          strategy.reason = `Full app has higher version and major difference: ${currentVersion} → ${latestFullAppVersion}`;
          strategy.priority = 'full';
        } else {
          strategy.useClientBundleUpdate = true;
          strategy.reason = `Client bundle preferred for minor/patch update: ${currentVersion} → ${latestClientBundleVersion}`;
          strategy.priority = 'client';
        }
      } else {
        strategy.useClientBundleUpdate = true;
        strategy.reason = `Client bundle has higher version: ${currentVersion} → ${latestClientBundleVersion}`;
        strategy.priority = 'client';
      }
    }

    return strategy;
  }

  /**
   * Get update strategy summary
   * @returns {Object} Strategy summary with recommendations
   */
  getStrategySummary() {
    return {
      currentVersion: this.currentVersion,
      latestFullAppVersion: this.latestFullAppVersion,
      latestClientBundleVersion: this.latestClientBundleVersion,
      recommendation: this.determineUpdateStrategy(
        this.currentVersion,
        this.latestFullAppVersion,
        this.latestClientBundleVersion
      )
    };
  }
}

// Create singleton instance
export const updateStrategy = new UpdateStrategy();