# Thirai Studio

**Thirai Studio** is the **C# / .NET 10** side of the repository — the tooling
and (in time) the development environment that lets users build, verify,
package, serve, and test webapps that run on the **Thirai framework** (the pure
HTML/JS/CSS runtime in [`../framework`](../framework)).

The two projects are deliberately separate:

| | `framework/` | `studio/` (this project) |
|---|---|---|
| What it is | the Thirai **runtime** + a governed workspace | **C# tooling** to develop on that runtime |
| Ships to the browser | yes (HTML/JS/CSS) | **never — zero bytes** |
| Language | HTML / JS / CSS | C# / .NET 10 |
| Runtime deps | none (static files) | none at runtime; BCL-only tools |

Studio tooling operates **on a framework workspace** (`framework/code/` in this
repo). Every tool accepts an explicit workspace root and, when run without one
inside this repo, auto-targets the sibling `framework/code`.

## Overriding priority: data privacy

Every Studio tool obeys the privacy invariants (see each tool's README): **zero
network I/O**, no persistence of scanned content, no developer-machine leakage,
deterministic output, and minimal explicit writes. The tooling exists to *enforce
and verify* the framework's privacy posture, so it holds itself to the same bar.

## Layout

```
studio/
└── code/
    ├── tools/
    │   ├── ThiraiVerify/    enforcement gate + privacy guardian (spec §15.4)
    │   └── ThiraiPackage/   privacy-scrubbing, reproducible .tpk builder (spec §8)
    └── tests/
        ├── ThiraiHost/      local Kestrel static host (loopback only)
        └── ThiraiTests/     Playwright + xUnit suite (real browser, CI gate)
```

See [`code/tools/README.md`](code/tools/README.md) for the tools and
[`code/tests/ThiraiTests/README.md`](code/tests/ThiraiTests/README.md) for the
tests. The zero-dependency **air-gapped browser test runner** is a
framework-native asset and lives with the runtime it tests:
[`../framework/code/tests/browser/`](../framework/code/tests/browser/).

## Build everything

```sh
# from the repo root
dotnet build studio/code/tools/ThiraiVerify   -c Release
dotnet build studio/code/tools/ThiraiPackage  -c Release
dotnet build studio/code/tests/ThiraiTests    -c Release
```

## Consuming LOCALSERVER

The generic local host + air-gapped **browser test runner** live in their own repo
([`LOCALSERVER`](../../LOCALSERVER)) and are consumed here as a **self-contained binary,
never a source/project reference**. Build it once over there
(`LOCALSERVER/build_test/publish.ps1`), then vendor it in:

```powershell
./build_test/pull-localserver.ps1        # copies release/v1 -> build_test/localserver/v1 (git-ignored)
```

Studio then shells out to the vendored tools — host any build and gate it through a real
browser (exit `0`/`1`):

```powershell
build_test\localserver\v1\testrunner\WebTestRunner.exe test <buildDir> `
    --page /tests/browser/test.html --expr window.__thiraiTestResult
```

The runner has zero third-party dependencies and no Thirai coupling; it only reads the
result expression you name. This is the intended replacement for the Playwright-based
`ThiraiHost`/`ThiraiTests` path above (retiring those is tracked separately).

## Roadmap

Studio will grow into the low-code/no-code development environment for Thirai
webapps (spec §12). The legacy Node deploy/support tools still live in the
framework workspace ([`../framework/code/tools/`](../framework/code/tools/)) and
are the next candidates to port to C# / .NET 10 here.
