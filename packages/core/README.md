# Sila Core

Core TypeScript shared across Sila apps and services.

- No separate build; app packages import this directly and bundle it.
- Type-check: `npm -w packages/core run check` (or `npm -w packages/core run watch`).

## Usage

```ts
import { /* exports */ } from '@sila/core';

```

## Test

We test things from core in ./tests