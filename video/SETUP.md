# Setup before capture

No Codex app plugin or external account connection is required for the edit. The editing agent needs filesystem access to this repository, and Pete needs only the capture, cleanup, music, and publishing services he chooses below.

## Required before recording

- [ ] **Screen Studio can export clean footage.** Install it, activate or start the available plan, make a 15-second 1440p test, and confirm the export has no watermark. Use 4K only if it exports quickly enough for repeated takes.
- [ ] **The phone can hold focus and exposure on white paper.** Make one test print under the intended light, lock focus/exposure, and check that the paper stays white rather than pulsing gray.
- [ ] **YouTube publishing works.** Confirm access to the channel that will host the public video and that it can upload a test or unlisted clip. The final must be Public, but a test can be deleted later.
- [ ] **There is enough local disk space.** Keep at least 25 GB free for source clips, proxies, and multiple renders even though this production should be much smaller than the Fable case study.
- [ ] **The product flow is frozen and rehearsed.** Use the exact Lisbon prompts in the screenplay and print one matching safety receipt before any screen capture.

## Agent tooling

Use the official Remotion agent instructions in whichever coding agent does the assembly:

```bash
npx skills add remotion-dev/skills
```

Run that from the eventual `video/edit/` package or follow the tool's project-scoped option if it offers one. Confirm the generated files stay under `video/` before accepting changes. Claude Code, Cursor, and Codex can consume the skill directly; Kimi can work from this folder's `AGENTS.md`, `HANDOFF.md`, and Remotion documentation even if it does not support the skill installer.

`video-shotcraft` is optional. Use it as a reference for shot composition and the “Ink Press” vocabulary, then copy only the pieces the edit actually needs and retain its Apache-2.0 notice. Verify the license of every bundled sound asset separately. Do not add `video-talkcraft` to a prize submission because its toolkit license is noncommercial.

## Optional accounts

- [ ] **Adobe Podcast:** Use Enhance Speech for the final voice if the dry recording has room noise or echo. A clean local recording needs no extra service.
- [ ] **Music source:** Prefer a YouTube Audio Library track filtered to “Attribution not required.” If using Eleven Music, use an eligible paid plan, avoid living-artist imitation, and save the prompt, invoice, model/version, and terms screenshot beside the audio.
- [ ] **Loom:** Create an account only if the Remotion cut misses its internal deadline. Loom is the fallback capture/edit path, not a dependency of the main plan.

## Music license record

For the chosen track, add `assets/audio/music-license.md` containing the title, creator or generator, source URL, download date, license or plan, attribution text if any, and a screenshot/file proving those terms. A track is not ready for the timeline until this record exists.
