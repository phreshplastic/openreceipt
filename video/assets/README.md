# Source media

Place human-supplied recordings in the paths defined by `../CAPTURE.md`. Keep original camera files until the final video is accepted, but put only the selected takes under the canonical names used by `../shot-plan.json`.

```text
assets/
  screen/
  physical/
  audio/
  stills/
```

The editing agent may create lightweight proxies under `../edit/.cache/`; source media stays unchanged. Record absent or unusable files in `MISSING.md` using the asset ID, what is wrong, and the exact replacement shot needed.
