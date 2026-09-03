# Setup before capture

No Codex app plugin or external account connection is required for the edit. The editing agent needs filesystem access to this repository, and Pete needs only the capture, cleanup, music, and publishing services he chooses below.

## Required before recording

- [ ] **Screen Studio can export clean footage.** Install it, activate or start the available plan, make a 15-second test, and confirm the export has no watermark. Then turn **auto-zoom off** and switch the export to flat — no rounded corners, shadow, padding, or wallpaper. The film supplies the frame; a beautified export has to be thrown away. Full settings at the top of `CAPTURE.md`.
- [ ] **The phone can hold focus and exposure on white paper.** Make one test print under the intended light, lock focus/exposure, and check that the paper stays white rather than pulsing gray.
- [ ] **YouTube publishing works.** Confirm access to the channel that will host the public video and that it can upload a test or unlisted clip. The final must be Public, but a test can be deleted later.
- [ ] **There is enough local disk space.** Keep at least 25 GB free for source clips, proxies, and multiple renders even though this production should be much smaller than the Fable case study.
- [ ] **The product flow is frozen and rehearsed.** Use the exact Lisbon prompts in the screenplay and print one matching safety receipt before any screen capture.

## Fonts and paper

No texture or font purchase is needed. The parchment and receipt stock are generated in software (`edit/src/paper`), and both faces are already vendored:

- **Inter** — copied from the product's `@fontsource-variable/inter` into `edit/public/fonts/`.
- **Ultra** — `src/assets/fonts/ultra-sign.ttf`, Apache 2.0, licence copied beside it in `edit/public/fonts/`. It is a **caps-only subset**, so it sets the wordmark and nothing else.

## Agent tooling

Remotion skills are vendored at the repository root in `.agents/skills/remotion-*`, with `skills-lock.json` for reproducible restores. The edit stays under `video/`; do not let an agent change the product app's dependencies when scaffolding `video/edit/`.

| Agent | How it gets Remotion |
| --- | --- |
| **Claude Code** | Trust this repo, then accept the Remotion plugin from `.claude/settings.json` (`remotion@remotion`). Skills also load from `.agents/skills/`. |
| **Cursor** | Project plugin at `.cursor-plugin/plugin.json` points at the vendored skills. Reload the window after a fresh clone if skills do not appear. |
| **Codex / OpenCode / others** | Read `.agents/skills/remotion-best-practices` first; the lockfile lists all twelve skills. |
| **Kimi** | Use `video/AGENTS.md`, `HANDOFF.md`, and the vendored skills if supported; otherwise Remotion docs. |

Restore or upgrade the vendored skills from the repo root:

```bash
npx skills experimental_install
# or, for a clean reinstall:
npx skills add remotion-dev/skills --all --copy --agent claude-code cursor codex opencode -y
```

Optional global plugins (outside this repo): install the [Remotion Cursor plugin](https://www.remotion.dev/docs/ai/cursor-plugin) from the Cursor Marketplace, or run `claude plugin marketplace add remotion-dev/claude-code-plugin && claude plugin install remotion@remotion` if you prefer the upstream plugin without the vendored copy.

`video-shotcraft` is optional. Use it as a reference for shot composition and the “Ink Press” vocabulary, then copy only the pieces the edit actually needs and retain its Apache-2.0 notice. Verify the license of every bundled sound asset separately. Do not add `video-talkcraft` to a prize submission because its toolkit license is noncommercial.

## Optional accounts

- [ ] **Adobe Podcast:** Use Enhance Speech for the final voice if the dry recording has room noise or echo. A clean local recording needs no extra service.
- [ ] **Music source:** Prefer a YouTube Audio Library track filtered to “Attribution not required.” If using Eleven Music, use an eligible paid plan, avoid living-artist imitation, and save the prompt, invoice, model/version, and terms screenshot beside the audio.
- [ ] **Loom:** Create an account only if the Remotion cut misses its internal deadline. Loom is the fallback capture/edit path, not a dependency of the main plan.

## Music license record

For the chosen track, add `assets/audio/music-license.md` containing the title, creator or generator, source URL, download date, license or plan, attribution text if any, and a screenshot/file proving those terms. A track is not ready for the timeline until this record exists.
