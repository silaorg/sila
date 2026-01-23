# Sila Core

Core TypeScript shared across Sila apps and services.

- No separate build; app packages import this directly and bundle it.
- Type-check (closest to lint): `npm -w packages/core run check` (or `npm -w packages/core run watch`).
  - Run this unless another build or lint task is already running.
  - Requires dependencies installed (`npm install` from repo root).

## Usage

```ts
import { /* exports */ } from '@sila/core';

```

## Test

We test things from core in ./tests
