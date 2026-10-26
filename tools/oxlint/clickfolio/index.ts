import { eslintCompatPlugin } from "vite-plus/lint/plugins";

import { noStringifiedErrorsRule } from "./rules/no-stringified-errors.ts";
import { siteDataContentFlagRule } from "./rules/site-data-content-flag.ts";

/** This repo's own invariants; the vendored anti-slop plugins hold the generic rules. */
const clickfolioPlugin = eslintCompatPlugin({
  meta: { name: "clickfolio" },
  rules: {
    "no-stringified-errors": noStringifiedErrorsRule,
    "site-data-content-flag": siteDataContentFlagRule,
  },
});

export default clickfolioPlugin;
