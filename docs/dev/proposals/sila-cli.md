# Proposal: Sila CLI

## Overview

This proposal outlines the design and implementation of a command-line interface (CLI) for Sila, enabling users and AI agents to interact with Sila workspaces, spaces, conversations, and assistants from the terminal. The CLI will provide a powerful, git-like interface for exploring, managing, and interacting with Sila's local-first data structures.

## Motivation

### User Benefits
- **Power users**: Terminal-based workflows for developers and power users
- **Automation**: Scriptable interactions with Sila workspaces
- **Remote access**: SSH-based access to Sila workspaces on remote machines
- **Integration**: Easy integration with other command-line tools and workflows

### AI Agent Benefits
- **Testing**: AI agents can programmatically test Sila functionality
- **Exploration**: Agents can explore workspace structures and content
- **Automation**: Agents can create conversations, manage assistants, and interact with AI models
- **Debugging**: Agents can inspect and debug Sila's internal state

### Technical Benefits
- **API exposure**: CLI provides a stable API for Sila's core functionality
- **Development**: Easier development and testing of Sila features
- **Documentation**: CLI serves as living documentation of Sila's capabilities

## Core Functionality

### Stateless Design
The Sila CLI follows git's stateless approach - commands are run from within a workspace directory, and the CLI automatically detects the workspace context. This eliminates the need for explicit workspace switching commands and makes the interface more intuitive.

### Workspace Detection
- Automatically detect workspace when running commands from workspace directory
- Validate workspace structure and provide helpful error messages
- Support for nested workspace detection (like git repositories)
- Clear error messages when not in a workspace directory

### Workspace Operations
- Check workspace status and information
- List workspace contents and structure
- Navigate workspace content like a filesystem
- Inspect workspace metadata and settings

### Conversation Management
- List conversations in a space
- Create new conversations
- View conversation history
- Branch and edit conversations
- Attach files to conversations

### Chat Interface
- Interactive chat with assistants
- Non-interactive chat (pipeline mode)
- Switch assistants during conversation
- Stream responses in real-time

### Assistant Management
- List available assistants
- Create new assistants
- View assistant configurations
- Test assistant responses

### File Operations
- Browse files in spaces
- Upload/download files
- View file metadata
- Manage file attachments

## Interface Design Options

### Option 1: Git-like Commands (Recommended)

This approach follows git's command structure with subcommands for different operations.

```bash
# Workspace operations (run from workspace directory)
sila status
sila ls [<path>]
sila tree [<path>]
sila cat <path>
sila info

# Conversation management
sila chat list
sila chat create [--assistant <name>] [--folder <path>]
sila chat show <id>
sila chat branch <id> <message-id>
sila chat edit <id> <message-id>

# Interactive chat
sila chat <id>
sila chat new [--assistant <name>]

# Assistant management
sila assistant list
sila assistant create <name>
sila assistant show <name>
sila assistant test <name> <message>

# File operations
sila file list [<path>]
sila file upload <path>
sila file download <id> [<output>]
sila file info <id>
```

**Pros:**
- Familiar to developers (git-like)
- Clear command hierarchy
- Easy to discover functionality
- Consistent with existing tools

**Cons:**
- More verbose for simple operations
- Requires learning command structure

### Option 2: Single Command with Flags

This approach uses a single `sila` command with flags and positional arguments.

```bash
# Workspace operations
sila --status
sila --ls [<path>]
sila --tree [<path>]
sila --cat <path>
sila --info

# Conversation management
sila --chat list
sila --chat create [--assistant <name>]
sila --chat show <id>
sila --chat <id>  # interactive mode

# Assistant management
sila --assistant list
sila --assistant create <name>
sila --assistant test <name> <message>

# File operations
sila --file list [<path>]
sila --file upload <path>
sila --file download <id>
```

**Pros:**
- Single command to remember
- Consistent flag structure
- Easy to script

**Cons:**
- Long command lines
- Less discoverable
- Flags can become complex

### Option 3: Hybrid Approach

This approach combines both patterns, using subcommands for major operations and flags for common options.

```bash
# Workspace operations (run from workspace directory)
sila status
sila ls [<path>]
sila tree [<path>]
sila cat <path>

# Conversation management
sila chat list
sila chat create [--assistant <name>]
sila chat <id>  # interactive mode

# Assistant management
sila assistant list
sila assistant create <name>
sila assistant test <name> <message>

# File operations
sila file list [<path>]
sila file upload <path>
sila file download <id>

# Global flags
sila --workspace <path> <command>   # specify workspace directory
sila --assistant <name> <command>   # specify assistant
```

**Pros:**
- Best of both worlds
- Flexible and powerful
- Good for both interactive and scripted use

**Cons:**
- More complex to implement
- Requires careful design of flag precedence

## Detailed Command Specifications

### Workspace Commands (Stateless)

```bash
sila status
# Shows workspace status and information
# Run from workspace directory (like git status)
# Output: workspace name, spaces count, assistants count, conversations count, last activity

sila ls [<path>]
# Lists contents of workspace or specified path
# Similar to 'ls' command for filesystems
# Options: -l (long format), -a (all), -h (human readable)
# Output: spaces, conversations, files, assistants

sila tree [<path>]
# Shows the tree structure of workspace content
# Similar to 'tree' command for filesystems
# Options: --depth <n>, --show-files, --show-metadata
# Output: hierarchical view of workspace structure

sila cat <path>
# Displays content of a workspace object
# Works with files, conversations, metadata, space configs
# Output: raw content of the specified object

sila info [<path>]
# Shows metadata about workspace or specific object
# Options: --format (json, yaml, plain)
# Output: type, size, created, modified, permissions, etc.
```

### Chat Commands

```bash
sila chat list [--space <id>] [--assistant <name>]
# Lists conversations
# Options: --space (filter by space), --assistant (filter by assistant)
# Output: id, title, assistant, created, last_message

sila chat create [--assistant <name>] [--folder <path>] [--title <title>]
# Creates a new conversation
# Options: --assistant (default assistant), --folder (target folder), --title (conversation title)

sila chat show <id> [--format <format>]
# Shows conversation history
# Options: --format (json, markdown, plain)
# Output: messages with metadata

sila chat <id>
# Interactive chat mode
# Opens a chat session with the specified conversation
# Supports: message input, assistant switching, file attachment

sila chat new [--assistant <name>] [--folder <path>]
# Creates and opens a new conversation interactively
# Shortcut for: sila chat create && sila chat <id>

sila chat branch <id> <message-id> [--message <text>]
# Creates a new branch from a message
# Options: --message (initial message for the branch)

sila chat edit <id> <message-id> [--text <text>]
# Edits an existing message
# Options: --text (new message content)
```

### Assistant Commands

```bash
sila assistant list [--space <id>]
# Lists available assistants
# Options: --space (filter by space)
# Output: name, model, description, created

sila assistant create <name> [--model <model>] [--instructions <text>]
# Creates a new assistant
# Options: --model (AI model), --instructions (system prompt)

sila assistant show <name>
# Shows assistant configuration
# Output: name, model, instructions, tools, settings

sila assistant test <name> <message> [--conversation <id>]
# Tests an assistant with a message
# Options: --conversation (use existing conversation)
# Output: assistant response

sila assistant edit <name> [--model <model>] [--instructions <text>]
# Edits an existing assistant
# Options: --model, --instructions (updates specified fields)
```

### File Commands

```bash
sila file list [<path>] [--space <id>]
# Lists files in workspace
# Options: --space (target space), --recursive
# Output: id, name, size, type, created

sila file upload <path> [--space <id>] [--folder <path>]
# Uploads a file to workspace
# Options: --space (target space), --folder (target folder)
# Output: file id and metadata

sila file download <id> [<output>] [--space <id>]
# Downloads a file from workspace
# Options: --space (source space), output (destination path)
# Default: downloads to current directory with original name

sila file info <id> [--space <id>]
# Shows file metadata
# Output: id, name, size, type, hash, created, modified

sila file attach <id> <conversation-id> [--space <id>]
# Attaches a file to a conversation
# Options: --space (source space)
```

## Interactive Features

### Chat Interface

The interactive chat mode provides a rich terminal experience:

```bash
sila chat <id>
# Opens interactive chat session
# Features:
# - Real-time message streaming
# - Assistant switching: /assistant <name>
# - File attachment: /attach <path>
# - Command help: /help
# - Exit: /quit or Ctrl+C
```

### Tab Completion

Comprehensive tab completion for:
- Workspace paths and directories
- Space IDs and paths
- Assistant names
- Conversation IDs
- File paths and IDs
- Command options and flags

### Configuration

```bash
sila config list
# Shows current configuration
# Output: workspace path, default assistant, output format, etc.

sila config set <key> <value>
# Sets configuration values
# Keys: workspace, assistant, format, editor, etc.

sila config get <key>
# Gets configuration value
```

## Output Formats

### Default Format
Human-readable output with colors and formatting for interactive use.

### JSON Format
Structured JSON output for scripting and automation:
```bash
sila chat list --format json
sila space tree --format json
sila assistant list --format json
```

### Plain Format
Plain text output without colors or formatting for piping to other tools.

## Error Handling

### Error Codes
- `0`: Success
- `1`: General error
- `2`: Invalid command or arguments
- `3`: Not in a workspace directory
- `4`: Space not found
- `5`: Conversation not found
- `6`: Assistant not found
- `7`: File not found
- `8`: Permission denied
- `9`: Network error

### Error Messages
Clear, actionable error messages with suggestions:
```bash
$ sila chat show invalid-id
Error: Conversation 'invalid-id' not found
Available conversations:
  - chat-123: "Python debugging help"
  - chat-456: "API documentation"
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. **CLI Framework**: Set up command-line parsing and routing
2. **Workspace Detection**: Detect workspace directories and validate
3. **Configuration**: User configuration and settings
4. **Error Handling**: Error codes and message formatting

### Phase 2: Workspace Navigation
1. **Core Commands**: status, ls, tree, cat, info
2. **Path Resolution**: Workspace path parsing and navigation
3. **Metadata Display**: Object information and formatting

### Phase 3: Chat Interface
1. **Chat Commands**: List, create, show, branch, edit
2. **Interactive Mode**: Real-time chat interface
3. **Assistant Integration**: Assistant switching and testing

### Phase 4: File Operations
1. **File Commands**: List, upload, download, info
2. **File Attachment**: Attach files to conversations
3. **File Management**: File metadata and organization

### Phase 5: Advanced Features
1. **Tab Completion**: Comprehensive completion system
2. **Output Formats**: JSON, plain, and formatted output
3. **Scripting Support**: Pipeline and automation features

## Technical Architecture

### Core Components

```typescript
interface SilaCLI {
  workspace: WorkspaceManager;
  chat: ChatManager;
  assistant: AssistantManager;
  file: FileManager;
  config: ConfigManager;
}

interface WorkspaceManager {
  detectWorkspace(cwd: string): Promise<Workspace | null>;
  getStatus(workspace: Workspace): Promise<WorkspaceStatus>;
  list(workspace: Workspace, path?: string): Promise<WorkspaceItem[]>;
  tree(workspace: Workspace, path?: string): Promise<TreeStructure>;
  cat(workspace: Workspace, path: string): Promise<string>;
  info(workspace: Workspace, path?: string): Promise<WorkspaceInfo>;
}

interface ChatManager {
  list(options: ListOptions): Promise<Conversation[]>;
  create(options: CreateOptions): Promise<Conversation>;
  show(id: string, format: OutputFormat): Promise<string>;
  interactive(id: string): Promise<void>;
  branch(id: string, messageId: string, options: BranchOptions): Promise<Conversation>;
  edit(id: string, messageId: string, text: string): Promise<void>;
}

interface AssistantManager {
  list(options: ListOptions): Promise<Assistant[]>;
  create(name: string, options: CreateOptions): Promise<Assistant>;
  show(name: string): Promise<AssistantInfo>;
  test(name: string, message: string, options: TestOptions): Promise<string>;
  edit(name: string, options: EditOptions): Promise<void>;
}

interface FileManager {
  list(path?: string, options: ListOptions): Promise<File[]>;
  upload(path: string, options: UploadOptions): Promise<File>;
  download(id: string, output?: string, options: DownloadOptions): Promise<void>;
  info(id: string): Promise<FileInfo>;
  attach(id: string, conversationId: string): Promise<void>;
}
```

### Integration with Sila Core

The CLI will integrate with Sila's existing core systems:

- **SpaceManager**: Access to workspace and space management
- **AppTree**: Navigation and manipulation of space trees
- **ChatAppBackend**: Conversation management and chat functionality
- **AssistantManager**: Assistant creation and management
- **FileStore**: File operations and management
- **RepTree**: CRDT operations for data consistency

### Dependencies

- **Commander.js**: Command-line argument parsing
- **Inquirer.js**: Interactive prompts and questions
- **Chalk**: Terminal colors and styling
- **Ora**: Loading spinners and progress indicators
- **Table**: Formatted table output
- **JSON**: JSON parsing and formatting

## Testing Strategy

### Unit Tests
- Individual command functionality
- Error handling and edge cases
- Output formatting and parsing
- Configuration management

### Integration Tests
- End-to-end command execution
- Workspace detection and navigation
- Chat and assistant interactions
- File operations and management

### AI Agent Tests
- Automated testing by AI agents
- Workspace exploration and navigation
- Conversation creation and management
- Assistant testing and validation

## Documentation

### User Documentation
- Command reference with examples
- Getting started guide
- Best practices and workflows
- Troubleshooting guide

### Developer Documentation
- API reference
- Extension points
- Contributing guidelines
- Architecture overview

### AI Agent Documentation
- Testing workflows
- Automation examples
- Integration patterns
- Best practices for agents

## Security Considerations

### Authentication
- No authentication required for local workspaces
- Optional authentication for remote workspaces
- Secure credential storage

### Permissions
- Respect workspace and space permissions
- File system access controls
- Network access restrictions

### Data Protection
- Local data remains local
- No data transmission without explicit commands
- Secure file handling and temporary storage

## Future Enhancements

### Advanced Features
- **Remote Workspaces**: SSH-based access to remote Sila installations
- **Workspace Sync**: CLI-based workspace synchronization
- **Batch Operations**: Bulk operations on multiple objects
- **Plugin System**: Extensible command system

### Integration
- **Shell Integration**: Fish, Zsh, Bash completion and integration
- **IDE Integration**: VS Code, Vim, Emacs extensions
- **CI/CD**: Automated testing and deployment workflows
- **Monitoring**: Workspace health and usage monitoring

### Performance
- **Caching**: Intelligent caching of workspace data
- **Lazy Loading**: On-demand loading of large datasets
- **Parallel Operations**: Concurrent execution of independent operations
- **Streaming**: Real-time streaming of large outputs

## Conclusion

The Sila CLI will provide a powerful, flexible interface for interacting with Sila workspaces from the command line. By following established patterns from tools like git and providing multiple interface options, the CLI will serve both interactive users and automated systems like AI agents.

The proposed design balances simplicity with power, providing easy-to-use commands for common operations while supporting complex workflows and automation. The implementation plan ensures a solid foundation that can be extended with advanced features over time.

The CLI will be an essential tool for power users, developers, and AI agents, enabling new workflows and use cases that aren't possible with the graphical interface alone.