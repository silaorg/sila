#!/usr/bin/env node

/**
 * Test script for update strategy logic
 * Demonstrates how the system chooses between full app updates and client bundle updates
 */

import { updateStrategy } from './src-electron/updates/updateStrategy.js';

// Test cases
const testCases = [
  {
    name: "Major version difference - should use full app update",
    current: "1.0.0",
    fullApp: "2.0.0",
    clientBundle: "1.1.0",
    expected: "full"
  },
  {
    name: "Minor version difference - should use client bundle update",
    current: "1.0.0",
    fullApp: "1.1.0",
    clientBundle: "1.0.1",
    expected: "client"
  },
  {
    name: "Patch version difference - should use client bundle update",
    current: "1.0.0",
    fullApp: "1.0.1",
    clientBundle: "1.0.2",
    expected: "client"
  },
  {
    name: "Only client bundle available - should use client bundle",
    current: "1.0.0",
    fullApp: null,
    clientBundle: "1.0.1",
    expected: "client"
  },
  {
    name: "Only full app available - should use full app",
    current: "1.0.0",
    fullApp: "1.1.0",
    clientBundle: null,
    expected: "full"
  },
  {
    name: "Same major, client bundle newer - should use client bundle",
    current: "1.0.0",
    fullApp: "1.0.1",
    clientBundle: "1.0.2",
    expected: "client"
  },
  {
    name: "Same major, full app newer - should use client bundle (prefer client for minor/patch)",
    current: "1.0.0",
    fullApp: "1.0.2",
    clientBundle: "1.0.1",
    expected: "client"
  },
  {
    name: "No updates available",
    current: "1.0.0",
    fullApp: null,
    clientBundle: null,
    expected: "none"
  }
];

console.log('🧪 Testing Update Strategy Logic\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`📋 ${testCase.name}`);
  console.log(`   Current: ${testCase.current}`);
  console.log(`   Full App: ${testCase.fullApp || 'None'}`);
  console.log(`   Client Bundle: ${testCase.clientBundle || 'None'}`);
  
  const strategy = updateStrategy.determineUpdateStrategy(
    testCase.current,
    testCase.fullApp,
    testCase.clientBundle
  );
  
  console.log(`   Strategy: ${JSON.stringify(strategy, null, 2)}`);
  
  let actualPriority = 'none';
  if (strategy.useFullAppUpdate) actualPriority = 'full';
  else if (strategy.useClientBundleUpdate) actualPriority = 'client';
  
  const success = actualPriority === testCase.expected;
  
  if (success) {
    console.log(`   ✅ PASS - Expected: ${testCase.expected}, Got: ${actualPriority}`);
    passed++;
  } else {
    console.log(`   ❌ FAIL - Expected: ${testCase.expected}, Got: ${actualPriority}`);
    failed++;
  }
  
  console.log('');
}

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed!');
} else {
  console.log('⚠️  Some tests failed. Check the logic.');
  process.exit(1);
}