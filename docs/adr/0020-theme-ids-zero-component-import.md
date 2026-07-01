# theme-ids.ts is a zero-component-import data module

`lib/templates/theme-ids.ts` carries `THEME_IDS`, `THEME_METADATA`, and unlock logic without importing any template components. This lets API routes / server code read theme metadata + unlock logic without pulling template component bundles into server routes.
