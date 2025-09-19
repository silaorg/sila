# Testing in Sila

Sila uses a comprehensive test suite built with Vitest to ensure reliability and correctness across its core functionality. This document covers the testing infrastructure, what's tested, and how to run tests.

## Test Suite Overview

The test suite is located in `packages/tests/` and uses Vitest as the testing framework. Tests run in a Node.js environment and focus on:

- **Core functionality**: Space creation, CRDT operations, and data persistence
- **File system operations**: Content-addressed storage (CAS) and file management
- **Security**: Secrets encryption/decryption
- **Integration**: Chat attachments and file references

## Running Tests

### Prerequisites
```bash
npm install
```

### Basic Commands
From the repository root:

```bash
# Run all tests
npm test

# Run tests in watch mode (tests package only)
npm -w packages/tests run test:watch

# Run tests from the tests package directly
npm -w packages/tests run test

# Run specific test file
npm -w packages/tests run test -- --run src/ai-image-bug.test.ts
```

### AI Testing Requirements
Some tests require OpenAI API access:
- Create a `.env` file in the root directory
- Add `OPENAI_API_KEY=your_actual_openai_api_key`
- Tests will skip if no valid API key is available

### Environment Considerations
If your environment blocks postinstall scripts, you can still run tests:

```bash
# Install without postinstall scripts
npm install --ignore-scripts

# Run tests directly
npm -w packages/tests run test
```

## What's Tested

### 1. Space Creation and Persistence
- **FileSystem persistence**: Tests that spaces can be created and persisted to disk
- **Ops storage**: Verifies CRDT operations are written to JSONL files correctly
- **Structure files**: Ensures space metadata and structure files are created properly

### 2. Secrets Management
- **Encryption/decryption roundtrip**: Tests that secrets can be encrypted, stored, and decrypted correctly
- **Key management**: Verifies secret keys are handled securely

### 3. Files Content-Addressed Storage (CAS)
- **Write/read roundtrip**: Tests that files can be written to CAS and retrieved correctly
- **Hash-based addressing**: Verifies files are stored and retrieved using SHA-256 hashes
- **Files AppTree linking**: Tests that file metadata is properly linked in the Files AppTree
- **Mutable storage**: Tests UUID-addressed mutable blobs for document editing workflows
- **Protocol support**: Verifies both SHA256 and UUID identifiers work in file protocol

### 4. Chat Attachments
- **Image persistence**: Tests that chat message attachments are saved to CAS
- **File references**: Verifies that messages store proper references to file vertices
- **Metadata handling**: Tests that file metadata (MIME type, size, etc.) is preserved

### 5. AI Integration Testing
- **Vision capabilities**: Tests that AI can see and respond to attached images
- **Backend initialization**: Verifies proper backend creation and message processing
- **Response verification**: Confirms AI responses contain expected content
- **Follow-up questions**: Tests that AI maintains context across multiple messages

## Local Assets for File Tests

To maintain deterministic and offline testing, file tests use local assets stored in:

```
packages/tests/assets/images/
packages/tests/assets/to-send/
```

### Supported Formats
- `.png` - PNG images
- `.jpg/.jpeg` - JPEG images  
- `.webp` - WebP images
- `.b64` - Base64-encoded text files

### AI Testing Assets
The `assets/to-send/` directory contains files specifically for AI testing:
- `cat.jpg` - Used in AI image bug reproduction tests to verify vision capabilities

### Adding Test Assets
You can add real images to the assets folder and commit them. Tests will automatically discover any supported files placed here.

**For `.b64` files:**
- Should contain base64 of raw bytes (no data URL prefix)
- Example on macOS/Linux: `base64 -w 0 input.png > my-image.b64`

**For image files:**
- Tests read raw bytes and infer MIME type from file extension
- Prefer small thumbnails for large images to keep the repository lean

## Test Structure

### Test Files
- `space.test.ts` - Space creation and basic persistence
- `secrets.test.ts` - Secrets encryption/decryption
- `files.test.ts` - File CAS operations and metadata
- `files-real.test.ts` - Real file handling with actual assets
- `chat-app-tree.test.ts` - Chat application tree operations
- `ai-image-bug.test.ts` - AI image attachment and response testing

### Test Utilities
- `node-file-system.ts` - Node.js file system utilities for testing

## Development Workflow

### During Development
```bash
# Run tests in watch mode for continuous feedback
npm -w packages/tests run test:watch
```

### Before Committing
```bash
# Run full test suite
npm test
```

### Debugging Tests
- Use `console.log()` or `debugger` statements in test files
- Vitest provides detailed error messages and stack traces
- Check the test output for specific failure details

## Best Practices

### Writing Tests
1. **Use descriptive test names** that explain what's being tested
2. **Test both success and failure cases** for robust coverage
3. **Use local assets** for file-related tests to ensure determinism
4. **Keep tests focused** on a single piece of functionality
5. **Clean up resources** after tests complete

### Test Data
- Use the `packages/tests/assets/images/` directory for file test data
- Prefer small, representative files over large assets
- Document any special requirements for test assets

## TODO: Missing Documentation

The following areas need additional documentation:

### High Priority
- [ ] **API Testing**: Documentation for testing the core API endpoints and services
- [ ] **UI Component Testing**: Guide for testing Svelte components and user interactions
- [ ] **Integration Testing**: End-to-end testing strategies for desktop and mobile apps
- [ ] **Performance Testing**: Guidelines for testing performance and memory usage
- [ ] **Error Handling Tests**: Documentation for testing error conditions and edge cases

### Medium Priority
- [ ] **Mocking Strategies**: How to mock external dependencies (AI providers, file system)
- [ ] **Test Data Management**: Best practices for managing test fixtures and data
- [ ] **Continuous Integration**: CI/CD testing pipeline documentation
- [ ] **Test Coverage**: Setting up and maintaining test coverage metrics

### Low Priority
- [ ] **Visual Regression Testing**: Testing UI changes and visual consistency
- [ ] **Accessibility Testing**: Testing for accessibility compliance
- [ ] **Cross-platform Testing**: Testing across different operating systems
- [ ] **Load Testing**: Testing with large datasets and high load scenarios

## Troubleshooting

### Common Issues

**Tests fail with file system errors:**
- Ensure you have write permissions in the test directory
- Check that the test assets directory exists and is accessible

**Tests fail with encryption errors:**
- Verify that the Node.js crypto module is available
- Check for any environment-specific crypto restrictions

**Watch mode not working:**
- Ensure you're running from the correct directory
- Check that file watching is enabled in your environment

### Getting Help
- Check the test output for specific error messages
- Review the test file structure and ensure all dependencies are installed
- Consult the Vitest documentation for framework-specific issues

## Related Documentation

- [Spaces](./spaces.md) - Understanding the space system being tested
- [Files in Spaces](./files-in-spaces.md) - File storage and CAS implementation
- [Project Structure](./project-structure.md) - Overall project organization
