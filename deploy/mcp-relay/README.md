# Optional port-443 MCP relay

Claude requires a public HTTPS endpoint on port 443. When your Pi's private editor already occupies that port in Tailscale Serve, a separate Vercel project can forward exactly `/mcp` to the bearer-protected public Funnel endpoint on port 8443. The relay contains no receipt database, editor, token, or printing logic. The Pi still validates every client credential and owns the queue.

Vercel terminates HTTPS and handles the client's Authorization header and receipt traffic in transit. Choose that provider explicitly before deploying; request headers and receipt content must not be added to logs. The example disables external rewrite caching. This is an optional hosted dependency, not a requirement for local OpenReceipt or the OpenAI tunnel.

## Prepare and deploy

Copy `public/` and `vercel.json.example` into a separate private deployment directory. Rename the latter to `vercel.json` and replace the destination with your already-verified public MCP endpoint. Do not deploy from the main repository root or reuse your portfolio project. Do not add credentials to the destination URL or configuration.

Use a separate project, for example `openreceipt-mcp-relay`, and deploy that directory:

```bash
vercel --prod --yes --name openreceipt-mcp-relay
```

Before using a credential, check the resulting production hostname. Unauthenticated GET and POST to `/mcp` must return 401; `/app`, `/api/v1/session`, and `/` must return 404. Only then verify an authenticated MCP initialization, tool listing, receipt listing, and PNG preview. Check that responses are not cached, missing and invalid credentials remain rejected, and the upstream is still the MCP listener rather than the editor.

Assign your chosen subdomain to this new project using Vercel's domain settings or CLI. Use the DNS target Vercel reports for that project; add only that subdomain's record at your DNS provider, leaving the domain's nameservers and existing portfolio records unchanged. Wait for domain verification and valid TLS, then repeat the checks through the final hostname. Claude's connector URL is `https://YOUR-MCP-HOST/mcp`, without a port suffix.

An external rewrite normally uses the destination's Host header, which the Pi already allows. If your ingress preserves the public hostname instead, add the exact hostname to `PETES_PRINTER_MCP_ALLOWED_HOSTS` and recreate only the MCP service. Keep SDK host and origin checks enabled.

## Limits and rollback

The relay is intended for this server's stateless request/response MCP workflow. Verify transport behavior with the actual client; a generic MCP preflight alone does not establish Claude compatibility. Long-lived streams are subject to hosting timeouts. A relay or Funnel outage prevents this route from working but does not stop the independent OpenAI tunnel or the private editor.

To remove the relay, disconnect its clients and remove the subdomain from the relay project and DNS. Remove the dedicated Vercel deployment/project when no longer needed. Revoke the corresponding client credential if disconnecting that agent permanently. This does not require changing your portfolio project or the private editor's Tailscale route.

See [Vercel's external rewrite documentation](https://vercel.com/docs/routing/rewrites) and the [Claude setup guide](../claude.md).
