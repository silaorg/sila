# heswe

Heswe is the npm package for creating and running lands.

Website: [heswe.com](https://heswe.com)

## Install

```bash
npm install -g heswe
```

You can also run it without a global install:

```bash
npx heswe@latest create my-land
```

## CLI

```bash
heswe create my-land
heswe run my-land
```

## JS API

```js
import { createLand, Land } from "heswe";

await createLand({ path: "./my-land", channel: "telegram" });

const land = new Land("./my-land");
await land.run();
```
