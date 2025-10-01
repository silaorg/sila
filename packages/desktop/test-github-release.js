#!/usr/bin/env node

/**
 * Test script for GitHub release functionality
 * This script tests the GitHub API integration without running the full Electron app
 */

import https from 'https';

const owner = 'silaorg';
const repo = 'sila';

async function testGitHubAPI() {
  try {
    console.log(`Testing GitHub API for ${owner}/${repo}...`);
    
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    console.log(`Fetching: ${url}`);
    
    const response = await makeHttpRequest(url);
    const release = JSON.parse(response);
    
    console.log('\n=== Latest Release Info ===');
    console.log(`Tag: ${release.tag_name}`);
    console.log(`Name: ${release.name}`);
    console.log(`Published: ${release.published_at}`);
    console.log(`Assets: ${release.assets.length}`);
    
    // Look for desktop-v{version}.zip asset
    const desktopAsset = release.assets.find(asset => 
      asset.name.startsWith('desktop-v') && asset.name.endsWith('.zip')
    );
    
    if (desktopAsset) {
      console.log('\n=== Desktop Build Found ===');
      console.log(`Name: ${desktopAsset.name}`);
      console.log(`Size: ${(desktopAsset.size / 1024 / 1024).toFixed(1)} MB`);
      console.log(`Download URL: ${desktopAsset.browser_download_url}`);
      
      // Extract version from asset name
      const versionMatch = desktopAsset.name.match(/desktop-v(.+)\.zip$/);
      if (versionMatch) {
        console.log(`Extracted Version: ${versionMatch[1]}`);
      }
    } else {
      console.log('\n=== No Desktop Build Found ===');
      console.log('Available assets:');
      release.assets.forEach(asset => {
        console.log(`  - ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)} MB)`);
      });
    }
    
  } catch (error) {
    console.error('Error testing GitHub API:', error);
  }
}

function makeHttpRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Sila-Desktop-Test',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

// Run the test
testGitHubAPI();