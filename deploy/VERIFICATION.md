# Personal installation verification

Verified on October 13, 2026 with an Epson TM-L90 over USB and an 80 mm roll. This records the installed implementation and distinguishes software results from paper confirmed by the owner. Installation and maintenance commands are in [README.md](README.md).

## Installed setup

The ARM64 Pi runs the bridge, canonical Node renderer, and HTTP MCP server in the OpenReceipt Compose stack. The editor/API and MCP ports bind to host loopback; existing Tailscale Serve exposes the owner editor privately. An explicitly approved Funnel route on port 8443 exposes only the bearer-protected HTTP MCP listener for other cloud clients. SQLite, print artifacts, and client credentials live in a persistent Docker volume. Home Assistant and the other application container configurations were left unchanged.

The previous printer bridge container was stopped and its restart policy disabled so only OpenReceipt owns USB. Stop other printer services before starting this stack; restoring another bridge requires stopping OpenReceipt first.

Codex uses the installed OpenReceipt plugin and a private token file. ChatGPT uses the official Secure MCP Tunnel, a dedicated bridge token, and a supervised host service. Both credentials permit automatic printing; the owner can switch to review mode or pause the queue. No credential values are included here.

## Completed checks

- The owner confirmed ten consecutive numbered laptop slips printed and cut cleanly. Duplicate submissions were suppressed. The owner also completed three laptop USB reconnect cycles.
- The owner confirmed Pi printing, a subsequent waiting job after a bridge restart, and a print requested from ChatGPT. ChatGPT also found saved receipts and previewed one before printing.
- The installed Codex plugin listed receipts, returned an image preview, and printed the first Shopping layout, which the owner confirmed on paper. Protocol verification used the installed plugin wrapper; a separate interactive Codex chat has not been checked.
- The final Pi build passed Compose health checks. A live backup was created before a full Pi reboot. A paused, unsent job and the pause setting survived that reboot; resuming the queue sent the same job successfully without a second submission. The Mac bridge was stopped for this check.
- After reboot, the installed Codex plugin read live USB readiness, saved receipts, the revised PNG preview, and the completed job. The owner confirmed that the revised Shopping slip printed and looked better.
- ChatGPT listed receipts and provided a link to the editable live receipt after the reboot, then printed successfully again. Image content is returned by MCP; this ChatGPT interface chose the exact-layout editor link rather than an inline image.
- The owner confirmed receipt listing, preview, and physical printing from the ChatGPT phone app with Tailscale off, verifying the mobile path through the Pi's outbound OpenAI tunnel.
- A backup was restored into a disposable volume, preserving four receipts and four jobs. The restored volume was removed after checking it. The pre-upgrade backup and the final installed backup remain on the Pi with private permissions.
- The implementation passed 203 TypeScript/MCP tests. The final hardening pass then reran 52 focused TypeScript/MCP checks, all 34 Python tests, and 35 Chrome browser tests. All 34 Python tests also passed inside the built ARM64 production image. Builds, type checks, and whitespace checks passed. The full lint run reported no errors and twelve warnings; lint on the final changed TypeScript files passed without warnings.

The tests cover simultaneous submissions, stable request ID deduplication, serialized probes and transmissions, waiting jobs across restart, interrupted transmissions becoming unknown, pause and cancellation races, revoked credentials, independent receipt revisions, migrations, and backup/restore. Independent MCP clients edited the same saved list without printing and exercised both stdio and HTTP transports. Browser tests checked shared edits, approval mode, and exact equality between the displayed canonical preview PNG and the render API result.

The final hardening regressions reproduced and fixed three additional cases: a credential revoked during an artifact upload could still enqueue a job, a USB cleanup error after cancellation could terminate the worker, and deleting a template during a pending save could target a temporary browser ID instead of the durable copy. These fixes are deployed to the Pi. Image tests now wait for the durable worker's terminal result instead of assuming a queued request has already completed.

Live retry verification found that a subsequent receipt edit caused the shared tool handler to reject an original request ID before the backend could replay it. The handler now resolves an existing request first. Both the installed Codex plugin and the updated Pi HTTP MCP endpoint returned the original completed job at its original revision, without creating another job or print; mismatched revisions on that same ID remain rejected.

Replacing the MCP container revealed that the tunnel client could exit successfully, leaving its former `Restart=on-failure` supervisor stopped. The deployed service now uses `Restart=always`, and automatic return to ready after a graceful process exit was verified. An intentional service stop still stops supervision. Token files, databases, and backup archives are excluded from Docker build contexts.

Layout checks covered shopping lists, reminders, morning briefs, and packing lists at 80 mm and 58 mm, including wrapped content and tables. A render regression verifies that bold and italic produce different pixels, previews retain smooth edges at twice the native width, and print rasters contain only black and white pixels. The revised layout increases body text by 20 percent and uses bundled regular, bold, and italic fonts.

## Public package verification

The reusable setup was checked from a source snapshot without build output, dependencies, receipts, or credentials. A separate ARM64 Compose project on the Pi built the editor, bridge, and Node runtime, passed all three health checks, and used its own fresh data volume and loopback ports. Its bridge had no USB mount or device permissions and used dummy output; the working installation and other containers were left running.

A fresh laptop client installed the locked dependencies, compiled MCP, and used a separately configured credential file. Independent stdio and HTTP clients created and edited a named shopping list without creating print jobs. The MCP preview PNG matched the render API's preview exactly. A credential without `print:automatic` still required owner approval under autonomous host policy; approval completed the dummy output, and retrying its stable request ID created no extra job.

The host helper reused its scoped credential without minting another token, downloaded and checksum-verified the official ARM64 tunnel client, and created a profile in a custom directory containing spaces. The generated service passed `systemd-analyze verify`. No test account was linked and no test tunnel service was installed; account linking remains an owner-driven wizard step. The existing real ChatGPT installation was verified separately as described above.

The reusable `openreceipt@openreceipt` plugin version 0.4.0 was installed and checked against the working Pi for status, saved receipts, and an image preview without printing; the superseded personal plugin was then removed. Final verification passed 203 TypeScript/MCP tests, 34 bridge tests, 11 setup tests, and seven public Chrome checks. The private editor's 35 Chrome checks also passed during this packaging work. Public build verification checks the HTML routes, guide metadata, discovery files, and the unchanged 160 kB initial JavaScript budget.

Compatible dependency fixes were applied to the lockfiles. The Docker Node runtime dependency audit reported no vulnerabilities. Four moderate npm findings remain in the guide build's `gray-matter` dependency chain; guides are checked-in trusted source, and the proposed forced downgrade was not applied. See [SECURITY.md](../SECURITY.md).

## Remaining hardware and client checks

The owner approved making only the authenticated HTTP MCP listener internet-reachable through Tailscale Funnel on port 8443. The editor on port 443 remains tailnet-only. A dedicated Claude credential passed status, saved-receipt listing and image preview through a public ingress IP with TLS verification enabled, rather than through local MagicDNS. Public unauthenticated GET/POST requests to `/mcp` returned 401; `/app` and `/api/v1/session` returned 404. Public DNS initially returned NXDOMAIN, then published after a route refresh and propagation. Claude itself still failed to connect; Anthropic's pinned troubleshooting note documents that its backend connects only on standard HTTPS port 443.

On October 14, the owner explicitly approved a separate Vercel relay, including Vercel handling the client's bearer credential and receipt traffic in transit. The isolated `openreceipt-mcp-relay` project forwards exactly `/mcp` to the protected Funnel endpoint and disables rewrite caching. The owner added the single `mcp` CNAME at Porkbun; Vercel verified the domain and issued TLS for `mcp.phreshplastic.com`. Through that final port-443 hostname, missing and invalid credentials returned 401, the root and owner editor/API paths returned 404, and an authenticated MCP client initialized, listed tools and six saved receipts, read status, and obtained a PNG preview. That preview's bytes exactly matched the direct Pi endpoint at the same receipt revision. No print was sent by either relay preflight. Existing portfolio routes, DNS nameservers, private editor routing, and the independent OpenAI tunnel were not changed. Recreating the Claude connector and verifying actual Claude account/mobile operations remain outstanding; Muse personal-agent setup remains unverified.

The final fresh USB discovery fix has automated coverage, but unplug/reconnect recovery without restarting the service has not been physically proven on the final Pi build. Earlier Pi attempts resumed after service restarts. The owner chose to defer further reconnect cycles because this installation will normally stay connected.

The rebooted job was confirmed on paper. USB status polling on this adapter did not provide reliable paper or cover feedback, so readiness currently confirms that the transport can open rather than asserting a paper sensor result. A job reported as succeeded by the bridge means transmission completed; it is not a paper sensor acknowledgement.

The laptop bridge is stopped, but operation with the laptop physically powered off has not been witnessed. Physical 58 mm printing and printers other than this TM-L90 are unverified. Other agent platforms receive standard MCP configuration without compatibility claims.
