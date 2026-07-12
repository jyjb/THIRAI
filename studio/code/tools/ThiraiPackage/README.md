# thirai-package (C# / .NET 10)

The Thirai Packager — builds a self-contained, **privacy-scrubbed**, **byte-reproducible**
`.tpk` for one application, and verifies one (spec §8, Tooling Brief Directive 2).
Native C# / .NET 10, **BCL only, zero NuGet dependencies**; uses only
`System.IO.Compression` (zip) and `System.Security.Cryptography` (SHA-256). Ships
**zero bytes to the browser**. It replaces the legacy Node packager
(`thirai-pack.mjs`, deleted).

There is no rebuild and no recompilation, ever: the bytes copied into the package
are the bytes that run (spec §8.2).

## Build & run

```sh
dotnet run -c Release -- <applicationId> [workspaceRoot] [--verifier <path>]
dotnet run -c Release -- --verify <file.tpk>

# publish the single self-contained executable
dotnet publish -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
# -> bin/Release/net10.0/win-x64/publish/thirai-package.exe
```

- `applicationId` — the folder under `applications/` to package.
- `workspaceRoot` — defaults to auto-detection: a folder with `applications/` and
  `framework/`, or (when run from Studio inside this repo) the sibling
  `framework/code`.
- `--verifier <path>` — path to `thirai-verify(.exe)`. If omitted, the packager
  looks for the verifier **next to its own executable** (the intended tools-bin
  deployment), and otherwise runs the **sibling `ThiraiVerify` project** via the
  SDK.

Output: `packages/<id>-<version>.tpk`. Exit codes: `0` ok · `1` refused /
integrity failure · `2` usage.

## `.tpk` layout (spec §8.1)

```
<id>-<version>.tpk
├── manifest.json      the application manifest
├── <app files>        pages/ templates/ datasources/ workflows/ assets/
├── package.json       package descriptor (below) — NOT npm's package.json
└── checksums.json     SHA-256 per file
```

Descriptor:

```json
{
  "package": "attavanai",
  "version": "1.0.0",
  "created": "1980-01-01T00:00:00Z",
  "framework": { "minVersion": "1.0.0" },
  "files": 23,
  "signature": "optional-enterprise-signing-block"
}
```

> `created` is a **normalized** timestamp (the ZIP epoch), not the real build
> time — this is deliberate (see "Privacy-first behaviour" below).

## `--verify <file.tpk>`

Recomputes every file's SHA-256 **without extracting** and compares to
`checksums.json`; also flags any checksummed file missing from the package. For
install-time validation (spec §8.2). Exit `0` = intact, `1` = corrupt/tampered.

## How this tool satisfies the privacy priority (Directive 0 + Directive 2)

1. **Exclusion scrub.** These never enter a package: directories `.git/`,
   `logs/`, `node_modules/`; files named `.DS_Store`, `Thumbs.db`; anything
   starting with `.env`; editor temp/backup (`*~`, `*.bak`, `*.swp`, `*.swo`,
   `*.tmp`, `*.log`); secret material (`*.pem`, `*.key`, `*.secret`, `*secret*.json`).
   Each scrubbed file is reported. Only the declared application folder is read —
   nothing about the build machine is packaged.
2. **Relative paths only.** Every zip entry name is app-relative with forward
   slashes; no absolute path can enter the package.
3. **Deterministic / reproducible.** Fixed entry ordering (sorted), normalized
   (fixed 1980-01-01) zip timestamps, and a normalized descriptor `created`
   field mean the same input yields a **byte-identical** `.tpk` — verifiable by
   hash. Build time and build machine never leak through zip metadata.
   (Confirmed by building twice and comparing bytes.)
4. **Gate integration.** Runs `thirai-verify` first and **aborts on non-zero
   exit** — an application in a workspace that fails the hardening/privacy gate
   cannot be packaged (spec §15.4 Packaging gate). Self-containment is also
   checked: every file referenced by `pages.json`, `datasources.json`, and
   `templates.json` must be present (spec §8.2).
5. **Zero network.** There is no HTTP client anywhere in this program.
6. **Minimal, explicit writes.** Writes exactly one artifact — the `.tpk` — into
   `packages/` (created if absent). No temp files, no other state.
