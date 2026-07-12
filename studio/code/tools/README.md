# Thirai Studio — Tools (C# / .NET 10)

The build-time enforcement tooling. Native **C# / .NET 10**, published as
**single self-contained executables**, **BCL only, no NuGet, no Node**. Each
tool ships **zero bytes to the browser** and obeys the Directive 0 privacy
invariants (see each tool's README for how).

These tools operate on a **framework workspace**. Pass the workspace root, or run
without one inside this repo to auto-target the sibling `framework/code`.

| Tool | Purpose | Docs |
|---|---|---|
| [`ThiraiVerify`](ThiraiVerify/) | Enforcement gate **and privacy guardian** (spec §15.4): dependency purity, no-bundling, CSP, allow-list, no bare throw, forbidden dirs, all size budgets, plus the privacy-guardian checks (`PRIV-LOG`/`PRIV-PERSIST`/`PRIV-NET`/`PRIV-CDN`). Hard-fails on any violation — no override. | [README](ThiraiVerify/README.md) |
| [`ThiraiPackage`](ThiraiPackage/) | Privacy-scrubbing, **byte-reproducible** `.tpk` builder (spec §8). Runs the verifier first and aborts on failure; `--verify` checks a package's integrity. | [README](ThiraiPackage/README.md) |

## Run (from the repo root)

```sh
# verify the framework workspace (auto-targets ../framework/code; or pass a path)
dotnet run --project studio/code/tools/ThiraiVerify -- framework/code
dotnet run --project studio/code/tools/ThiraiVerify -- framework/code --report verify-report.json

# package an application (runs the verifier gate first)
dotnet run --project studio/code/tools/ThiraiPackage -- <appId> framework/code
dotnet run --project studio/code/tools/ThiraiPackage -- --verify framework/code/packages/<id>-<ver>.tpk
```

Publish either as a single self-contained executable:

```sh
dotnet publish studio/code/tools/ThiraiVerify -c Release -r win-x64 \
  --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
```

When both executables are published side by side in one directory, the packager
finds `thirai-verify(.exe)` next to itself automatically; otherwise it runs the
sibling `ThiraiVerify` project via the SDK.

## Governed policy data (lives with the framework workspace)

The rules these tools enforce are **data, not code**, and are versioned with the
framework workspace they govern:

- `framework/code/governance/budgets.json` — size budgets (spec §15.2).
- `framework/code/governance/privacy.policy.json` — the privacy-guardian rules
  (spec §11.3, §15.4).

## Tests

The Playwright/CI test suite and the local static host live under
[`../tests/`](../tests/). The zero-dependency air-gapped browser runner is a
framework-native asset in
[`../../../framework/code/tests/browser/`](../../../framework/code/tests/browser/).
