# silaland

Silaland is the npm package for creating and running lands.

## Install

```bash
npm install -g silaland
```

You can also run it without a global install:

```bash
npx silaland@latest create my-land
```

## CLI

```bash
silaland create my-land
silaland run my-land
```

## JS API

```js
import { createLand, Land } from "silaland";

await createLand({ path: "./my-land", channel: "telegram" });

const land = new Land("./my-land");
await land.run();
```
