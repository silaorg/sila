#!/usr/bin/env node

/**
 * Test script to verify the getAllAvailableDesktopBuilds functionality
 */

import { GitHubReleaseManager } from './src-electron/githubReleaseManager.js';

async function testAllDesktopBuilds() {
  console.log('Testing getAllAvailableDesktopBuilds...\n');
  
  const manager = new GitHubReleaseManager('sila-ai', 'sila');
  
  try {
    // Test getting all available desktop builds
    console.log('Fetching all available desktop builds from recent releases...');
    const allBuilds = await manager.getAllAvailableDesktopBuilds();
    
    console.log(`\nFound ${allBuilds.length} desktop builds:\n`);
    
    allBuilds.forEach((build, index) => {
      console.log(`${index + 1}. v${build.version}`);
      console.log(`   Release: ${build.releaseTag}`);
      console.log(`   Published: ${new Date(build.publishedAt).toLocaleDateString()}`);
      console.log(`   Size: ${build.size ? (build.size / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown'}`);
      console.log(`   Asset: ${build.assetName}`);
      console.log('');
    });
    
    if (allBuilds.length > 0) {
      console.log('✅ Successfully retrieved all available desktop builds');
      console.log(`📊 Summary: Found ${allBuilds.length} builds across recent releases`);
    } else {
      console.log('⚠️  No desktop builds found in recent releases');
    }
    
  } catch (error) {
    console.error('❌ Error testing getAllAvailableDesktopBuilds:', error);
  }
}

// Run the test
testAllDesktopBuilds();