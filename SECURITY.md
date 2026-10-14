# Security

OpenReceipt is self-hosted. The owner editor has no public user-account system: anyone allowed onto its private access path can obtain an owner browser session. Keep host ports on loopback and use owner-restricted Tailscale access or an SSH forward. Do not expose the owner editor directly to the public internet. Docker's internal bind is published only on host loopback.

Headless MCP calls also require a scoped bridge bearer credential. Automatic printing requires `print:automatic` and the bridge's owner policy. Keep each client's token separate so it can be revoked independently; revocation cancels that credential's unsent jobs. Review and owner pause remain available. No API key, token file, database, receipt artifact, or backup belongs in source control; backups include credentials and need private storage.

Each ChatGPT owner creates and links their own Secure MCP Tunnel. The runtime key stays in private files, and the stdio wrapper supplies a dedicated bridge credential. “No authentication” in that tunnel configuration does not mean publishing an unauthenticated owner editor.

An optional public route for other cloud clients must terminate at the credential-protected HTTP MCP listener, never the owner editor or bridge API. Require a separate scoped bearer credential for each client. Claude's “No sign-in” setting uses the credential supplied in its required Authorization request header; it does not remove server authentication. Tailscale Funnel makes that selected port internet-reachable even when the editor's separate port stays private. See [Claude setup](deploy/claude.md) for verification and rollback.

An optional hosted MCP relay also handles Authorization headers and receipt traffic in transit. Choose its hosting provider explicitly, forward only the MCP path, disable response caching, and keep client credentials out of deployment configuration and logs. The relay must preserve the printer host's credential checks; never inject an owner token to make unauthenticated requests work. See [the isolated relay example](deploy/mcp-relay/README.md).

Guide Markdown and frontmatter are trusted repository source, not user uploads. The guide build currently has four moderate npm audit findings through `gray-matter`; do not use that parser for untrusted content. The separate Docker Node runtime does not include the guide parser, and its locked dependency audit was clean during release verification.

Report vulnerabilities privately to the repository owner. Do not include receipts, configuration databases, home-network details, or credentials in public issues. Transmissions marked unknown require a paper check before a new print request, because the transport cannot establish whether the slip finished.
