# Claude on the web and phone

Claude requires standard HTTPS port 443 for remote MCP connections. A working public endpoint on `:8443` is insufficient: [Anthropic's pinned troubleshooting note](https://github.com/anthropics/claude-ai-mcp/issues/125) says its backend does not connect to other ports. Use a dedicated public ingress on port 443 that forwards only to the authenticated MCP listener. Do not turn an existing private editor on port 443 into a public Funnel to accommodate Claude.

One option is the separate [MCP relay](mcp-relay/README.md), which forwards only `/mcp` from a standard HTTPS hostname to the Pi's protected Funnel endpoint. It uses a separate hosting project and requires no migration of your existing domain's nameservers.

Claude's remote connectors run through Anthropic's cloud, including when you use its mobile app. They need an internet-reachable MCP endpoint. A phone's Tailscale connection does not provide network access to Anthropic's servers. The OpenAI Secure MCP Tunnel is a separate connection used by supported OpenAI clients.

OpenReceipt's HTTP MCP listener requires a scoped bearer credential. Claude can store it as a request header when that feature is available to your account. This avoids adding an OAuth service. Check your connector dialog first: request-header authentication is currently a limited beta. If the option is absent, do not use an unauthenticated route or put the credential in the URL; an OAuth adapter is required.

See [Claude's connector instructions](https://claude.com/docs/connectors/custom/add-unlisted) and [network requirements](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## Prepare a separate credential

On your printer host, create a dedicated client token after the Docker stack is healthy:

```bash
python3 scripts/setup-host.py token --name claude \
  --token-file "$HOME/.config/openreceipt/claude.token"
```

Add `--automatic` only when granting this client automatic printing. The bridge's policy and owner pause still apply. Keep the token file private, and copy it securely to the computer where you will configure Claude. Never paste it into a chat or include it in source control. Revoke the dedicated credential to disconnect Claude without affecting other clients.

## Make only MCP reachable

The owner editor trusts your private network and must remain private. Before enabling a public route, verify that its upstream is the HTTP MCP listener at `127.0.0.1:8733`, not the editor/bridge at `127.0.0.1:8731`. The MCP listener rejects missing or revoked credentials; `/app` and `/api/v1/session` return 404 on this listener.

Tailscale Funnel is one way to provide HTTPS without a separate domain or inbound router port. For Claude, it needs a dedicated Tailscale node whose port 443 serves only MCP, or another public HTTPS ingress on port 443. It makes the selected listener internet-reachable; request-header authentication protects its tools, rather than making the route private. Explicitly choose this exposure before continuing. Preserve other existing routes and do not use `funnel reset`.

On the host, inspect and privately save the existing configuration:

```bash
tailscale serve status
umask 077
tailscale serve status --json > "$HOME/.config/openreceipt/serve-before-claude.json"
```

For generic MCP clients that support port 8443, the editor can remain private on port 443 while only the separate MCP listener becomes public. This configuration is not a Claude-compatible endpoint:

```bash
sudo tailscale funnel --bg --https=8443 http://127.0.0.1:8733
tailscale serve status
```

Tailscale may ask you to enable Funnel in its admin console. Confirm that status shows port 443 as tailnet-only and port 8443 as Funnel. Public DNS propagation can take up to ten minutes. Set `PETES_PRINTER_MCP_ALLOWED_HOSTS` in the printer host's private `.env` to include the exact HTTPS hostname with `:8443`, then recreate only the MCP container if needed. The private Tailscale setup already includes this host when using the same endpoint.

Check the route from outside your tailnet: unauthenticated GET and POST to `/mcp` must return 401; `/app` and `/api/v1/session` must return 404. Then use a dedicated credential to verify status, listing, and an image preview without printing. Don't put the credential in a public URL or diagnostic output.

To revert port 8443 to the former private MCP route:

```bash
sudo tailscale serve --bg --https=8443 http://127.0.0.1:8733
tailscale serve status
```

Using Serve on that port makes it private again. The ChatGPT tunnel is independent of this route and continues to use the local Docker MCP process.

## Add the connector in Claude

1. Prepare and verify a dedicated public HTTPS endpoint on port 443, such as `https://mcp.example.com/mcp`, forwarding only to the authenticated MCP listener. Include that hostname in `PETES_PRINTER_MCP_ALLOWED_HOSTS`. Open **Customize → Connectors → Add custom connector** in Claude on the web, name it OpenReceipt, and enter the verified endpoint URL without `:8443`. A chosen hostname is not usable until DNS, TLS, routing, and authenticated MCP checks pass.
2. Select **No sign-in**, which supports a fixed API credential. Add a required request header named **Authorization**. Its value must be `Bearer ` followed by your token, including the space. Enter it directly into Claude's credential field, never into a conversation. OAuth client options do not apply to this connection.
3. Keep **Streamable HTTP** as the transport and add the connector. Start a new chat, enable OpenReceipt, and ask it to list your saved receipts without printing.
4. Preview a named receipt, then print it once when requested. Check an existing queued job rather than submitting another copy. On your phone, use the same Claude account, turn Tailscale off, and repeat listing, preview, and one requested print.

If an existing connector has the wrong authentication settings, remove it and add it again: Claude does not allow editing saved request headers or authentication settings. Repeated reconnect attempts cannot repair a blocked port.

For a Mac token file, this command copies the full header value without displaying it:

```bash
python3 -c 'from pathlib import Path; import sys; sys.stdout.write("Bearer " + Path.home().joinpath(".config/openreceipt/claude.token").read_text().strip())' | pbcopy
```

Clear the clipboard after saving the credential. Keep Claude's account credential storage separate from MCP configuration published in this repository.

## Other cloud agents

An HTTP MCP client that can supply a bearer header can use the same authenticated endpoint with its own scoped credential. Muse's personal-agent setup still needs account-level verification; its connector directory and Muse Code are different products. Do not claim Muse personal-agent compatibility based solely on a successful generic MCP client test.
