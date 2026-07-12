# thirai-verify (C# / .NET 10)

The Thirai Verifier — the offline, build-time enforcement gate **and privacy
guardian** (spec §15.4, Tooling Brief Directive 1). Native C# / .NET 10, **BCL
only, zero NuGet dependencies**, ships **zero bytes to the browser**. It does not
transform, bundle, or minify anything: it inspects files and says yes or no,
hard-failing (non-zero exit) on any violation. **There is no override flag**
(spec §15). It replaces the legacy Node verifier (`thirai-verify.mjs`, deleted).

## Build & run

```sh
# run in place (dev)
dotnet run -c Release -- [workspaceRoot] [--report <path>]

# publish the single self-contained executable (BCL only, no runtime install needed)
dotnet publish -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
# -> bin/Release/net10.0/win-x64/publish/thirai-verify.exe

thirai-verify.exe                 # auto-detects the workspace root
thirai-verify.exe ../..           # explicit workspace root
thirai-verify.exe ../.. --report verify-report.json
```

`workspaceRoot` defaults to auto-detection: the tool walks up from the executable
(and the current directory) for a folder containing both `governance/budgets.json`
and `framework/`; failing that (e.g. when run from Studio), it targets the sibling
`framework/code` workspace in the same repo. Pass the root explicitly to verify
any other workspace. Exit codes: `0` all pass · `1` one or more violations · `2`
usage / missing governance data.

## Checks

**Enforcement (carried over from the Node verifier, spec §15.4):**

| Check | What it enforces |
|---|---|
| A1 | Dependency purity — every `import`/`export from`/dynamic `import()` in `framework/` and `applications/` resolves to a relative path (`./`, `../`). No npm, CDNs, bare specifiers. |
| A2 | No bundling/minification — no `.min.js`, no `sourceMappingURL`, no >1000-char lines. |
| A3 | CSP present & strict in `index.html`; every baseline directive present; no `unsafe-inline`/`unsafe-eval`/wildcard; `connect-src` == `'self'` + exactly the datasource allow-list. |
| A4 | Datasource allow-list — every REST datasource origin is on `governance/policies/datasources.policy.json`. |
| C2 | No bare `throw new Error/TypeError/…` in `framework/` — must use `kernel.error(...)` / `ThiraiError`. |
| DIRS | Forbidden directories absent (`components/ hooks/ stores/ contexts/ reducers/ providers/`) — detected even when empty. |
| BUDGET | Every size budget in `governance/budgets.json` (total JS uncompressed + gzipped, total CSS, per-file kernel/engine line+byte caps, per-application page-metadata cap). |
| A6 | Dependency surface — emits the count of framework files the runtime can load (finite, auditable). |

**Privacy-guardian (NEW — the priority), driven by `governance/privacy.policy.json`:**

| Check | What it enforces |
|---|---|
| PRIV-LOG | Runtime logs must stay in memory — no file/disk-write APIs (`showSaveFilePicker`, `createWritable`, `node:fs`, `writeFileSync`, …) in `framework/`. Runtime logging is the in-memory `logBuffer` only (spec §11, §15.3 C1/C4). |
| PRIV-PERSIST | No browser persistence — no `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB` in `framework/`. |
| PRIV-NET | No external calls from framework core — no `XMLHttpRequest`/`sendBeacon`/`EventSource`/`WebSocket`, and no `fetch()` pointed at an absolute external origin. (App *datasources* make governed REST calls constrained by the allow-list — separate and legitimate.) |
| PRIV-CDN | No third-party tracking/CDN references — no remote `<script src>`/`<link href>`, no remote CSS `url()`/`@import`, no analytics/tracker snippets in `index.html` or framework assets. |

The privacy rules are **governed data, not hardcoded logic**: they live in
`governance/privacy.policy.json` and are reviewed and versioned like any policy
(Directive 5). Editing that file changes what the verifier enforces — no rebuild
of the tool required.

## How this tool satisfies Directive 0 (privacy of the tool itself)

1. **Zero network I/O.** There is no HTTP client anywhere in the program — no
   telemetry, analytics, update check, or license call. It runs fully offline /
   air-gapped. (You can confirm: the source imports only `System.*`.)
2. **No persistence of scanned content.** It reads files to check them and never
   copies, caches, or writes their *contents*. Reports carry metrics and
   violation locations (`file:line`) only — never source snippets.
3. **No developer-machine leakage.** Every path in console output and in the JSON
   report is workspace-relative. No absolute paths, usernames, home dirs,
   hostnames, env vars, or timestamps are emitted.
4. **Deterministic output.** Same input → identical output, byte for byte
   (verified by running twice and comparing). File enumeration is sorted; no
   time or machine state enters the output. Gzip sizing uses a fixed compression
   level and approximates the server's compression — acceptable for a gate.
5. **Minimal, explicit writes.** Console-only unless `--report <path>` is passed,
   in which case it writes exactly that one JSON file and nothing else — no temp
   files, no hidden state, no logs to disk.

## Report format (`--report`)

Minimal JSON — `tool`, `result` (pass/fail), `violations` count, a `checks`
array (check name + `file:line` detail for each violation), and a `budgets`
array (label, value, limit, unit, pass/fail). No source content, no machine
info, no timestamps.
