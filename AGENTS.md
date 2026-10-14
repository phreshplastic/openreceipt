# OpenReceipt

This repository contains the Vite/TypeScript editor, WebMCP and headless MCP surfaces, and Python printer bridge. Use this checkout as the project boundary. The separate `petes-printer` repository is outside scope unless the user explicitly requests cross-repository work.

Inspect the nearby implementation and tests before changing behavior. Use package scripts as the source of truth and the smallest relevant verification command. Leave dependency environments, build output, generated assets, unrelated dirty files, and personal credentials alone unless the task targets them. MCP workflow tests need the bridge virtual environment and compiled MCP bundle; their temporary bridge uses dummy output.

People and agents share revision-checked receipts. Named lists have independent IDs and revisions. Preserve existing receipts, jobs, and legacy tool names/environment variables. Physical printing requires owner approval or an explicitly permitted credential under the owner's bridge policy. Do not bypass review, queue pause, or unknown-transmission handling. Hardware tests that print paper must be within the user's authorized task.

Use sentence-case UI labels and hierarchy through size, weight, spacing, and proximity. Receipt shelf titles differ from printed headings: new blanks are Untitled, Untitled 2, and so on. Agents choose short distinctive titles and rename generic names. Preserve the established wordmarks and layout direction.

The public release is experimental and self-hosted. Claim only the verified TM-L90 USB/80 mm physical path. Distinguish rendered 58 mm support from unverified physical printing, and keep hardware recovery limits in deploy/VERIFICATION.md. Public setup must use the installer's own host, account, directories, and scoped credentials; never default to the maintainer's private installation. Update setup tests when changing provisioning or plugin configuration.

For installation and recovery work, read deploy/README.md. For plugin/client setup, read plugins/openreceipt/README.md. Historical competition notes live in docs/archive/competition-instructions.md and are relevant only when the user requests work on that submission.
