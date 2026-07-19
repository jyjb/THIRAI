# THIRAI

A lightweight HTML, CSS and Vanilla JavaScript application framework for rapid
website and web-app development — paired with the tooling that builds,
verifies, packages, and governs it.

## About

THIRAI is the umbrella repository for two deliberately separate projects:

- **[`framework/`](framework)** — the Thirai runtime itself: a metadata-driven
  application platform built entirely on HTML5, CSS3, and Vanilla JavaScript.
  No bundler, no transpiler, no npm runtime dependencies.
- **[`studio/`](studio)** — the C# / .NET tooling that develops, verifies,
  packages, and tests applications built on that runtime.

The runtime ships to the browser; the tooling never does. Together they let a
developer, a support engineer, an operations team, and an enterprise governance
function all work against the same platform without stepping on each other.

## Why It Exists

Most web frameworks trade simplicity for capability: a virtual DOM, a build
pipeline, a deep dependency tree, and a learning curve measured in weeks.
Thirai exists for the opposite trade — an application platform that a browser
and a static web server can run unmodified, where applications are *declared*
in metadata rather than wired in code, and where governance, diagnostics, and
packaging are part of the platform instead of bolted on afterward.

The end user should never know Thirai exists. They should see fast pages,
clean URLs, and applications that behave like ordinary websites — because they
are ordinary websites, served as static assets from any web server on earth.

## Vision

A lightweight platform for rapid website and web-application development that
an enterprise can govern, an operations team can deploy, a support engineer can
diagnose, and a developer can master in an afternoon — scaling from one
application to a thousand without changing its architecture.

## Philosophy

Every design decision serves one of five human outcomes:

1. **A developer is productive within hours.** Building an application means
   writing a manifest and page metadata, not learning a rendering model.
2. **A support engineer diagnoses without reading source code.** Diagnostics
   endpoints and structured errors carry the application, workflow, step, and
   reason.
3. **An enterprise can govern applications.** Routes, ownership, versions, and
   datasources are registered, validated, and auditable.
4. **Operations deploy without understanding internals.** A package is
   validated, deployed, health-checked, published, and rolled back if anything
   fails.
5. **The end user never knows the framework exists.** No framework-shaped
   URLs, no exposed internals, no loading spinners for framework boot.

The full set of ten architectural principles behind these outcomes is in the
[framework specification](framework/docs/SPECIFICATION.md#2-vision-philosophy--design-principles).

## Key Features

- **Zero build step** — static HTML/CSS/JS, runnable from any web server.
- **Metadata-driven pages** — applications are declared (manifests, page
  metadata, datasources, workflows), not hand-wired.
- **Nine cooperating engines** — kernel-mediated, independently replaceable,
  reporting `healthy` diagnostics.
- **Governance built in** — routes, datasources, and workflows are validated
  at registration, deployment, and runtime, not by convention.
- **`.tpk` packaging** — self-contained, reproducible application packages
  with deploy and rollback.
- **Structured diagnostics** — workflow and runtime errors carry enough
  context to debug without opening source.
- **Tiny footprint** — the entire framework runtime is ~110 KB uncompressed /
  ~35 KB gzipped.
- **Independent tooling** — Studio's C#/.NET tools build, verify, and package
  workspaces without ever shipping a byte to the browser.

## Architecture

```
                    ┌─────────────────────────────┐
                    │           Kernel             │
                    │  (events · services · errors)│
                    └───────────────┬──────────────┘
                                    │  registry lookups · kernel events · named services
        ┌──────────────┬───────────┼───────────┬──────────────┬─────────────┐
        │              │           │           │              │             │
    Registry        Router     Manifest     Page /       Datasource     Governance /
    Engine          Engine     Engine       Template      Engine        Diagnostics
                                             Engine                     Engines
```

The **Registry** is the single queryable source of truth for everything that
exists. No engine imports another directly — engines cooperate only through
kernel-mediated channels, so any engine honoring the same contracts can be
swapped. **Studio** sits outside this runtime entirely: it operates *on* a
framework workspace from the outside (build, verify, package) and ships zero
bytes to the browser. Browser-level testing is delegated to
[**LOCALSERVER**](../LOCALSERVER), a sibling project consumed as a published,
self-contained binary — never a source reference.

Full rationale and contracts: [`framework/docs/SPECIFICATION.md`](framework/docs/SPECIFICATION.md).

## Components

| | [`framework/`](framework) | [`studio/`](studio) |
|---|---|---|
| What it is | the Thirai runtime + a governed workspace | tooling to develop on that runtime |
| Ships to the browser | yes (HTML/JS/CSS) | never — zero bytes |
| Language | HTML / CSS / JavaScript | C# / .NET 10 |
| Runtime dependencies | none (static files) | none; BCL-only tools |

## Getting Started

**Use the framework** — build the release artifacts and pick a path:

```powershell
cd framework
./build_test/release.ps1
```

This produces, under `release/v1/`:

- **`thirai-starter-workspace`** — unzip, serve, open `localhost`. A running
  app in minutes.
- **`thirai-framework-runtime`** — the immutable runtime, for upgrading an
  existing workspace's `framework/`.

**Build the tooling** — from the repo root:

```sh
dotnet build studio/code/tools/ThiraiVerify   -c Release
dotnet build studio/code/tools/ThiraiPackage  -c Release
```

## Documentation

- [`framework/docs/MANUAL.md`](framework/docs/MANUAL.md) — how pages,
  templates, modules, datasources, and workflows are actually used.
- [`framework/docs/CONSUMING.md`](framework/docs/CONSUMING.md) — full
  recipes for new developers, operators, and runtime upgrades.
- [`framework/docs/SPECIFICATION.md`](framework/docs/SPECIFICATION.md) —
  the canonical architecture specification.
- [`studio/code/tools/README.md`](studio/code/tools/README.md) — the
  Studio tools (ThiraiVerify, ThiraiPackage).
- [`studio/docs/THIRAI-STUDIO-REQUIREMENTS.md`](studio/docs/THIRAI-STUDIO-REQUIREMENTS.md) —
  requirements for the Studio development environment.

## Roadmap

- Grow Studio into a low-code/no-code development environment for Thirai
  webapps.
- Port the legacy Node.js deploy/support tools
  ([`framework/code/tools/`](framework/code/tools)) to C# / .NET in Studio.
- Retire the Playwright-based `ThiraiHost`/`ThiraiTests` path in favor of the
  LOCALSERVER-based browser test runner.

## Contributing

This project is early-stage and actively evolving. Before opening a change:

- Read the [philosophy](#philosophy) and the ten principles in the
  [specification](framework/docs/SPECIFICATION.md) — changes should trace
  back to one of them.
- Keep the framework runtime dependency-free; keep Studio tooling BCL-only.
- Open an issue describing the problem before sending a large change, so
  design direction can be agreed on first.

## License

Licensed under the [GNU General Public License v3.0](LICENSE).
