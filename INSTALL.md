# Repository Installer

Use the installer to set up dependencies and validate the project in one step.

## Prerequisite

- Node.js 20+ and npm

## Run installer

From the repository root:

```bash
npm run install:repo
```

The installer runs:

1. `npm install`
2. `npm run build`
3. `npm run test -w @portfolio-margin/core`

## Start web app

```bash
npm run dev -w web
```
