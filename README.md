# @n8codes/apexlink

Thin Node invoker for [`@apex-dev-tools/apex-ls`](https://github.com/apex-dev-tools/apex-ls), which is delivered as a JAR. This package runs the ApexLink JAR in a subprocess and returns the JSON dependency report.

This package is a maintained hard-fork of the archived [`@flxbl-io/apexlink`](https://www.npmjs.com/package/@flxbl-io/apexlink).

## Requirements

- Node.js 22 or later
- Java 21 or later (the bundled `apex-ls` JARs require class file version 65)

## Install

```bash
npm install @n8codes/apexlink
```

Existing deep imports continue to work:

```ts
import ApexDepedencyCheckImpl from '@n8codes/apexlink/lib/ApexDepedencyCheckImpl';
```

You can also import from the package root:

```ts
import ApexDepedencyCheckImpl from '@n8codes/apexlink';
```

## License

MIT. Bundled `apex-ls` JARs remain under the BSD license included in `LICENSE`.
