# Files

Sila stores files **inside your workspace**. Nothing is uploaded by default.

## Attach files to a chat

Attach images or text documents to a message. The assistant can reference them later.

## Browse workspace files

Use the Files app to organize files into folders and reuse them across chats.

## How file storage works (high level)

Sila stores file bytes under your workspace folder:

- **Binary files (images, etc.)**: stored as **content-addressed** blobs (SHA-256 hash). This makes them immutable and deduplicated.
- **Text files**: stored as **mutable** documents (UUID). This allows tools to update them safely.

