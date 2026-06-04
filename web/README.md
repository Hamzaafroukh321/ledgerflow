# LedgerFlow Console

The LedgerFlow console is a React application for catalog, simulation, audit, usage, customer, and saved-run workflows.

## Environment

| Variable | Purpose |
| --- | --- |
| `VITE_LEDGERFLOW_API_BASE` | Optional API base URL. Leave empty when the console is served by the API process. |
| `VITE_LEDGERFLOW_API_TOKEN` | Bearer token sent to the API. |
| `VITE_LEDGERFLOW_ROLE` | `viewer`, `editor`, or `admin`; viewer hides write controls. |

## Commands

```bash
npm install
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run e2e
```
