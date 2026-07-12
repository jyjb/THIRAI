# Thirai Framework v1
## Architecture & Implementation Specification

| | |
|---|---|
| **Document** | Thirai Framework — Architecture & Implementation Specification |
| **Version** | 1.0.0 |
| **Status** | Draft for Review |
| **Organization** | NiraiNarai Workshop |
| **Classification** | Internal — Engineering & Governance |

---

## 1. Executive Summary

Thirai Framework is a metadata-driven, enterprise-governed application platform built entirely on HTML5, CSS3, and Vanilla JavaScript (ES6+). It is not a component framework, not an SPA framework, and not a virtual-DOM renderer. It is an **application platform**: a runtime kernel, a set of cooperating engines, and a governance layer that together host many isolated applications described by metadata rather than code.

The framework exists to make four roles successful simultaneously. A **developer** becomes productive within hours because applications are declared, not wired. A **support engineer** diagnoses production issues from diagnostics endpoints and structured errors, without ever opening source code. An **operations team** deploys self-contained `.tpk` packages with no build step, no compilation, and full rollback. An **enterprise** governs every route, page, datasource, and workflow through a validation layer that is part of the platform itself, not bolted on afterward.

The end user never knows Thirai exists. They see fast pages, clean URLs, and applications that behave like ordinary websites — because they are ordinary websites, served as static assets from any web server on earth.

### 1.1 What Thirai Is

A governed runtime that resolves business-friendly URLs to metadata-described pages, renders them through reusable templates, feeds them from declared datasources, executes human-readable workflows, validates everything against governance rules, and reports its own health.

### 1.2 What Thirai Is Not

Thirai deliberately rejects the architecture of React, Angular, Vue, Svelte, and their ecosystems. There is no virtual DOM, no hooks, no state stores, no JSX, no transpilation, no bundler, and no npm dependency chain. The framework runs directly from static files. If a browser and a web server exist, Thirai runs.

---

## 2. Vision, Philosophy & Design Principles

### 2.1 Vision

A lightweight platform for rapid website and web-application development that an enterprise can govern, an operations team can deploy, a support engineer can diagnose, and a developer can master in an afternoon — scaling from one application to a thousand without changing its architecture.

### 2.2 Philosophy

The framework is designed around five human outcomes:

1. **A developer is productive within hours.** Creating an application means writing a manifest and page metadata, not learning a rendering model.
2. **A support engineer diagnoses without source code.** Diagnostics endpoints and structured, human-readable errors carry enough context to identify the application, the workflow, the step, and the reason.
3. **An enterprise can govern applications.** Routes, ownership, versions, datasources, and dependencies are registered, validated, and auditable.
4. **Operations deploy without understanding internals.** A package is validated, deployed, health-checked, published — and rolled back if anything fails.
5. **The end user never knows the framework exists.** No loading spinners for framework boot, no exposed internals, no framework-shaped URLs.

### 2.3 The Ten Principles

Every architectural decision in this document traces back to one or more of these principles:

| # | Principle | Architectural Consequence |
|---|-----------|---------------------------|
| 1 | Everything must be **understandable** | Metadata is plain JSON; errors are sentences; no abstractions deeper than two layers |
| 2 | Everything must be **discoverable** | The Registry is the single queryable source of truth for everything that exists |
| 3 | Everything must be **packageable** | The `.tpk` format captures a complete application with zero external references |
| 4 | Everything must be **deployable** | Static assets only; any web server is a valid host |
| 5 | Everything must be **diagnosable** | Every application and engine exposes structured diagnostics |
| 6 | Everything must be **governable** | Governance Engine validates at registration, deployment, and runtime |
| 7 | Everything must be **scalable** | Application isolation; stateless runtime; horizontal scaling is the default |
| 8 | Everything must be **replaceable** | No engine imports another directly; engines cooperate only through three kernel-mediated channels — registry lookups, kernel events, and named kernel services (§3.3) — so any engine honoring the same contracts can be swapped |
| 9 | **No hidden behavior** | Nothing happens that is not declared in metadata or visible in the registry |
| 10 | **No magic** | No conventions that silently change behavior; configuration is explicit |

### 2.4 Technology Constraints

**Allowed:** HTML5, CSS3, Vanilla JavaScript ES6+, JSON, REST APIs, Web Components (optional, for template encapsulation only).

**Forbidden:** React, Angular, Vue, Svelte, virtual DOM, hooks, state stores (Redux/MobX), npm dependency chains, webpack, vite, babel, transpilers, and build pipelines of any kind.

The forbidden list is not a stylistic preference — it is the mechanism that delivers Principles 3, 4, and 10. A framework with no build step cannot have build-step failures, cannot drift between source and artifact, and cannot hide behavior inside a bundler plugin.

---

## 3. System Architecture

### 3.1 Architectural Layers

Thirai is organized into four strict layers. Dependencies point downward only; no layer may reach upward.

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 4 — APPLICATIONS                                 │
│  Metadata + assets. No framework code. No business      │
│  logic in pages. (attavanai, arivular, tharavu, ...)    │
├─────────────────────────────────────────────────────────┤
│  LAYER 3 — ENGINES                                      │
│  Router · Registry · Manifest · Page · Template ·       │
│  Datasource · Workflow · Governance · Diagnostics       │
├─────────────────────────────────────────────────────────┤
│  LAYER 2 — KERNEL                                       │
│  Boot sequence · Engine lifecycle · Event bus ·         │
│  Error envelope · Configuration loader                  │
├─────────────────────────────────────────────────────────┤
│  LAYER 1 — PLATFORM                                     │
│  Browser APIs · Web server (static) · REST endpoints    │
└─────────────────────────────────────────────────────────┘
```

**Layer 1 — Platform.** The browser and any static-capable web server. Thirai assumes nothing beyond standards-compliant HTML/CSS/JS and the ability to serve files and (optionally) proxy REST calls.

**Layer 2 — Kernel.** A small (< 500 lines) bootstrap that loads configuration, starts engines in declared order, provides a synchronous publish/subscribe event bus, and defines the universal error envelope. The kernel contains no application knowledge.

**Layer 3 — Engines.** Nine cooperating services, each with a single responsibility, a declared contract, and its own diagnostics. Engines never import each other directly; they communicate through the kernel's event bus and through registry lookups. This is what makes Principle 8 (replaceability) real.

**Layer 4 — Applications.** Pure metadata and assets. An application is a folder containing a manifest, page definitions, template references, datasource declarations, workflow definitions, and static assets. Applications contain no engine code and pages contain no business logic.

### 3.2 Boot Sequence

The boot sequence is deterministic, observable, and identical in every environment:

```
index.html
   ↓ loads
thirai-kernel.js
   ↓ reads
framework/config/thirai.config.json
   ↓ starts (in order)
Registry → Manifest → Governance → Router → Template → Page → Datasource → Workflow → Diagnostics
   ↓ then
Router resolves current URL → Registry lookup → Manifest check →
Governance gate → Page metadata load → Template render → Datasource bind
   ↓
Page visible. Diagnostics heartbeat begins.
```

Each boot step emits a kernel event (`thirai:boot:engine-started`, `thirai:boot:complete`). A failed boot step halts the sequence and renders the framework's structured error page — never a blank screen, never a console-only stack trace.

### 3.3 Engine Communication Contract

Engines interact through three mechanisms, all visible, all loggable, and — critically — **all mediated by the kernel rather than by direct engine-to-engine imports**:

1. **Registry lookups** — synchronous reads of registered metadata (`registry.get('page', 'attavanai/home')`).
2. **Kernel events** — published facts (`route:resolved`, `page:rendered`, `workflow:step:failed`) that any engine may subscribe to.
3. **Named kernel services** — engines expose a frozen, named service surface on the kernel at boot (`kernel.templates`, `kernel.governance`, `kernel.datasources`, …), and other engines call these by name+shape contract. The Registry acts as the composition root; page→templates, datasource→governance, router→governance, and workflow→datasources are all resolved this way.

The precise, load-bearing guarantee is this: **no engine imports another engine directly.** Engines are loaded by the kernel via dynamic `import()` and cooperate only through the three kernel-mediated channels above — never through static cross-engine imports, shared mutable state, or callbacks passed across engine boundaries. Replaceability is therefore preserved by *contract* (name + shape), not by the absence of coupling: real runtime coupling exists through channel 3, but any engine can be swapped for another that honors the same registry entries, event topics, and named service surface. This is what keeps every engine independently testable and independently replaceable.

> **On Principle 8's phrasing.** The one-line statement of Principle 8 ("engines communicate only through registry lookups and kernel events") is a useful shorthand but *under-describes* the real design — it omits channel 3, the named kernel services the platform actually relies on. The binding contract is the one stated here in §3.3: kernel-mediated cooperation with no direct cross-engine imports. Where the Principle 8 shorthand and this section appear to differ, §3.3 governs.

---

## 4. Workspace & Folder Structure

### 4.1 Workspace Layout

```
workspace/
│
├── framework/                      # The Thirai runtime (versioned, immutable per release)
│   ├── kernel/
│   │   ├── thirai-kernel.js
│   │   ├── thirai-events.js
│   │   └── thirai-errors.js
│   ├── engines/
│   │   ├── router.engine.js
│   │   ├── registry.engine.js
│   │   ├── manifest.engine.js
│   │   ├── page.engine.js
│   │   ├── template.engine.js
│   │   ├── datasource.engine.js
│   │   ├── workflow.engine.js
│   │   ├── governance.engine.js
│   │   └── diagnostics.engine.js
│   ├── templates/                  # Framework-provided base templates
│   │   ├── landing-page/
│   │   ├── product-page/
│   │   ├── dashboard-page/
│   │   ├── form-page/
│   │   ├── documentation-page/
│   │   └── catalog-page/
│   ├── styles/
│   │   └── thirai-base.css
│   └── config/
│       └── thirai.config.json
│
├── applications/                   # Installed applications (one folder each)
│   ├── attavanai/
│   │   ├── manifest.json
│   │   ├── pages/
│   │   ├── templates/              # App-specific template overrides (optional)
│   │   ├── datasources/
│   │   ├── workflows/
│   │   └── assets/
│   ├── arivular/
│   └── tharavu/
│
├── packages/                       # .tpk packages (inbound and built)
│   ├── attavanai-1.0.0.tpk
│   └── attavanai-1.1.0.tpk
│
├── deployments/                    # Deployment descriptors & history
│   ├── deployment.log.json
│   └── environments/
│       ├── local.json
│       ├── staging.json
│       └── production.json
│
├── logs/                           # Structured runtime logs (JSON lines)
│   ├── framework/
│   └── applications/
│
└── governance/                     # Governance policies & audit trail
    ├── policies/
    │   ├── routes.policy.json
    │   ├── naming.policy.json
    │   ├── datasources.policy.json
    │   └── dependencies.policy.json
    └── audit/
        └── audit.log.json
```

### 4.2 What Is Deliberately Absent

There are no `components/`, `hooks/`, `stores/`, `contexts/`, `reducers/`, or `providers/` directories anywhere in a Thirai workspace, and the governance naming policy explicitly forbids creating them. Their absence is structural proof that Thirai applications are declarative metadata, not component trees.

### 4.3 Application Anatomy

Every application folder is self-describing and self-contained:

```
attavanai/
├── manifest.json                   # Identity, route, version, ownership — mandatory
├── pages/
│   ├── home.page.json
│   ├── pricing.page.json
│   └── docs.page.json
├── templates/                      # Only if overriding framework templates
│   └── attavanai-product/
│       ├── template.json
│       ├── template.html
│       └── template.css
├── datasources/
│   ├── features.datasource.json
│   └── pricing-api.datasource.json
├── workflows/
│   └── generate-timetable.workflow.json
└── assets/
    ├── images/
    ├── styles/
    └── content/
```

---

## 5. Engine Design

Each engine is specified here by responsibility, contract, metadata it consumes, events it emits, and its diagnostics surface. Engines are single-file ES6 modules with no external dependencies.

### 5.1 Router Engine

**Responsibility.** Clean URL management, application route resolution, navigation, and route governance.

**Behavior.** The router maps business-friendly URLs to registered routes — never to filesystem paths. It supports both history-API routing (when the host server rewrites to `index.html`) and a static fallback mode for servers without rewrite capability. Internal structure is never exposed:

```
Good:   /products/attavanai
        /products/attavanai/pricing
Bad:    /src/pages/products/attavanai.html
        /applications/attavanai/pages/home.page.json
```

**Resolution flow.**

```
URL → normalize → Registry route lookup → found?
  ├── yes → Governance gate (published? allowed?) → emit route:resolved
  └── no  → emit route:not-found → render framework 404 page
```

**Contract.**

| Operation | Description |
|---|---|
| `resolve(url)` | Returns `{ applicationId, pageId, params }` or a structured not-found result |
| `navigate(url)` | Pushes history state, triggers resolution, never reloads the document |
| `register(route)` | Called by Registry during application registration; validated by Governance first |

**Events emitted.** `route:resolved`, `route:not-found`, `route:blocked` (governance denial), `navigation:started`, `navigation:completed`.

**Diagnostics.** Route table size, last 50 resolutions with timings, count of not-found and blocked resolutions.

### 5.2 Registry Engine

**Responsibility.** Maintain the authoritative registrations for applications, pages, templates, datasources, workflows, and extensions. The Registry is the single source of truth — if it is not in the Registry, it does not exist (Principle 2).

**Structure.** The registry is a set of typed catalogs, each keyed by fully-qualified ID (`applicationId/itemId`):

```json
{
  "applications": { "attavanai": { "...": "manifest summary" } },
  "pages":        { "attavanai/home": { "...": "page metadata" } },
  "templates":    { "framework/product-template": {}, "attavanai/attavanai-product": {} },
  "datasources":  { "attavanai/features": {} },
  "workflows":    { "attavanai/generate-timetable": {} },
  "extensions":   {}
}
```

**Rules.** Registration is atomic per application — either every item in an application registers and passes governance, or none do. Duplicate routes and duplicate IDs are registration-time failures, not runtime surprises. The registry is queryable at runtime (`/thirai/registry` diagnostics view) so support engineers and the future Thirai IDE can discover everything that exists.

**Events emitted.** `registry:application-registered`, `registry:application-removed`, `registry:conflict`.

### 5.3 Manifest Engine

**Responsibility.** Load, validate, and expose application manifests. The manifest is an application's identity document and is mandatory — an application folder without a valid `manifest.json` is invisible to the platform.

**Canonical manifest.**

```json
{
  "id": "attavanai",
  "name": "Attavanai Maker Pro",
  "version": "1.0.0",
  "owner": "NiraiNarai Workshop",
  "route": "/products/attavanai",
  "published": true,
  "framework": { "minVersion": "1.0.0" },
  "entry": "pages/home.page.json",
  "dependencies": [],
  "contact": { "support": "support@nirainarai.com" }
}
```

**Validation.** `id` must match the folder name and the naming policy; `version` must be semantic; `route` must be unique across the workspace; `published: false` makes the application resolvable only in environments where governance permits previews. Validation failures produce structured, sentence-form errors (see §11).

### 5.4 Page Engine

**Responsibility.** Load page metadata, bind it to a template, and orchestrate rendering. Pages are pure metadata — they declare *what* appears, never *how*, and they contain no business logic (logic belongs in workflows, data in datasources).

**Page metadata model.**

```json
{
  "id": "home",
  "type": "landing-page",
  "template": "product-template",
  "title": "Attavanai Maker Pro — Timetables Without Tears",
  "regions": {
    "hero": {
      "heading": "Build school timetables in minutes",
      "subheading": "Constraint-aware. Conflict-free. Printable.",
      "action": { "label": "Try it", "navigate": "/products/attavanai/app" }
    },
    "features": { "datasource": "features" },
    "footer": { "content": "assets/content/footer.html" }
  }
}
```

**Render flow.**

```
page metadata → template lookup (Registry) → region binding
  ├── literal values  → inserted as text/attributes (HTML-escaped by default)
  ├── datasource refs → Datasource Engine fetch → bound on arrival
  └── content refs    → static asset fetch → sanitized insert
→ emit page:rendered
```

### 5.5 Template Engine

**Responsibility.** Provide reusable rendering structures. A template is an HTML skeleton with named regions, a stylesheet, and a JSON descriptor declaring which regions exist and what each accepts.

**Template descriptor.**

```json
{
  "id": "product-template",
  "name": "Product Page Template",
  "version": "1.0.0",
  "regions": {
    "hero":     { "accepts": ["heading", "subheading", "action"] },
    "features": { "accepts": ["datasource"], "repeats": true },
    "footer":   { "accepts": ["content"] }
  }
}
```

**Mechanics.** Templates use HTML `<template>` elements and named region markers (`data-thirai-region="hero"`). Rendering is direct DOM construction — `cloneNode`, `textContent`, and attribute assignment. There is no diffing, no re-render cycle, and no virtual DOM: a page renders once, and subsequent data updates touch only the specific regions bound to the changed datasource. Templates may optionally be packaged as Web Components for style encapsulation, but this is never required.

**Framework templates.** Landing Page, Product Page, Dashboard Page, Form Page, Documentation Page, Catalog Page — versioned with the framework. Applications may override or add templates; overrides are registered under the application's namespace and never mutate framework templates.

### 5.6 Datasource Engine

**Responsibility.** Declarative data access for pages and workflows. Supported in v1: static JSON files, REST APIs, and static content fragments. The connector model is explicitly designed so SQL, SAP, and custom connectors can be added later without changing any page or workflow metadata.

**Datasource declarations.**

```json
{
  "id": "features",
  "type": "json",
  "source": "assets/content/features.json",
  "cache": { "mode": "session" }
}
```

```json
{
  "id": "pricing-api",
  "type": "rest",
  "source": "https://api.nirainarai.com/attavanai/pricing",
  "method": "GET",
  "timeoutMs": 5000,
  "retry": { "attempts": 2, "backoffMs": 500 },
  "cache": { "mode": "ttl", "ttlSeconds": 300 }
}
```

**Behavior.** Every fetch is governed (datasource policy controls allowed hosts), timed, logged, and surfaced in diagnostics. Failures return a structured error to the page engine, which renders the region's declared fallback rather than breaking the page.

### 5.7 Workflow Engine

**Responsibility.** Execute metadata-driven, human-readable workflows. Workflows are the only place business logic lives, and even there the *orchestration* is metadata; steps invoke registered step handlers.

**Workflow definition.**

```json
{
  "id": "generate-timetable",
  "name": "Generate Timetable",
  "trigger": { "type": "action", "source": "generate-button" },
  "input": { "datasource": "timetable-request" },
  "steps": [
    { "id": "validate",  "type": "validate", "rules": "workflows/rules/timetable.rules.json" },
    { "id": "allocate",  "type": "allocate", "handler": "attavanai.allocateTeachers" },
    { "id": "resolve",   "type": "transform", "handler": "attavanai.resolveConflicts" },
    { "id": "publish",   "type": "output", "target": "datasource:generated-timetable" }
  ],
  "onError": { "report": true, "rollbackTo": "validate" }
}
```

**Execution semantics.** Steps run sequentially; each step receives the prior step's output; every step start, completion, and failure is logged with the workflow ID, step ID, and elapsed time. A step failure produces the full supportability error format (§11) automatically — application, workflow, step, reason — because the engine knows all four at the moment of failure.

### 5.8 Governance Engine

**Responsibility.** Validate routes, pages, templates, datasources, workflows, and dependencies against workspace policies. Governance is built into the platform's critical paths — registration, deployment, and route resolution — not added later (Principle 6).

**Policy model.** Policies are JSON documents in `governance/policies/`, evaluated at three gates:

| Gate | When | Validates |
|---|---|---|
| **Registration gate** | Application registers with the Registry | Manifest completeness, ID/route uniqueness, naming policy, template/datasource references resolve |
| **Deployment gate** | Package installation (§8) | Package integrity, version progression, framework compatibility, dependency availability |
| **Runtime gate** | Route resolution, datasource fetch | Published state, environment allow-lists, datasource host allow-list |

**Example route policy.**

```json
{
  "id": "routes.policy",
  "rules": [
    { "rule": "unique-routes", "severity": "error" },
    { "rule": "no-filesystem-paths", "pattern": "^(?!.*\\.(html|json|js)).*$", "severity": "error" },
    { "rule": "business-friendly", "pattern": "^/[a-z0-9-/]+$", "severity": "error" }
  ]
}
```

Every governance decision — pass or fail — is appended to `governance/audit/audit.log.json` with timestamp, actor, gate, and outcome, giving the enterprise a complete audit trail.

### 5.9 Diagnostics Engine

**Responsibility.** Make every application and every engine observable without source code access. Detailed in §11.

---

## 6. Metadata Models — Summary Schema Reference

All Thirai metadata shares common conventions: lowercase kebab-case IDs, semantic versions, explicit references (never implied by file location), and no executable content inside metadata.

| Artifact | File pattern | Mandatory fields | Registered as |
|---|---|---|---|
| Manifest | `manifest.json` | id, name, version, owner, route, published | `applications/{id}` |
| Page | `pages/*.page.json` | id, type, template | `pages/{app}/{id}` |
| Template | `templates/*/template.json` | id, name, version, regions | `templates/{ns}/{id}` |
| Datasource | `datasources/*.datasource.json` | id, type, source | `datasources/{app}/{id}` |
| Workflow | `workflows/*.workflow.json` | id, steps | `workflows/{app}/{id}` |
| Policy | `governance/policies/*.policy.json` | id, rules | governance only |
| Package descriptor | inside `.tpk` | manifest + checksums | deployment only |

Forward compatibility rule: engines ignore unknown metadata fields (allowing newer applications on older runtimes to degrade gracefully) but never ignore unknown *values* of known fields (failing loudly instead — Principle 10).

---

## 7. Governance Model

Governance in Thirai is a platform capability with four pillars.

**Identity & ownership.** Every application declares an owner and a support contact in its manifest. Nothing anonymous can be registered. The registry answers, at any moment, "what is deployed, what version, who owns it, and how do I reach them."

**Policy enforcement.** Workspace policies (routes, naming, datasources, dependencies) are evaluated at the three gates described in §5.8. Policies are versioned JSON, reviewed like any other governed artifact, and applied uniformly — there is no mechanism for an application to opt out.

**Auditability.** Registrations, deployments, rollbacks, governance denials, and publish-state changes are appended to an immutable audit log. The audit trail plus the deployment history answers compliance questions without forensic effort.

**Lifecycle control.** `published` is a governed state, not a deployment side effect. An application can be deployed but unpublished (staged), published, deprecated (resolvable, flagged in diagnostics), or retired (package archived, route released). State transitions pass through the governance gate and are audited.

---

## 8. Packaging Strategy

### 8.1 The `.tpk` Format

A Thirai Package (`.tpk`) is a ZIP container with a defined layout and integrity manifest:

```
attavanai-1.0.0.tpk
├── manifest.json               # The application manifest
├── package.json                # Package descriptor (below) — not npm's package.json
├── pages/
├── templates/
├── datasources/
├── workflows/
├── assets/
└── checksums.json              # SHA-256 per file
```

**Package descriptor.**

```json
{
  "package": "attavanai",
  "version": "1.0.0",
  "created": "2026-06-12T10:00:00Z",
  "framework": { "minVersion": "1.0.0" },
  "files": 42,
  "signature": "optional-enterprise-signing-block"
}
```

### 8.2 Package Guarantees

A valid `.tpk` is **installable** (drop into `packages/`, run install), **portable** (no absolute paths, no environment references, no external fetches at install time), **versioned** (semantic version in descriptor and filename), **self-contained** (every referenced template, datasource, and asset is inside the package or provided by the framework), and **removable** (uninstall deletes the application folder, deregisters every item, and releases the route — leaving no residue).

There is no rebuild and no recompilation, ever. The bytes in the package are the bytes that run. Install is: validate checksums → governance deployment gate → copy to `applications/{id}/` → register → health check.

---

## 9. Deployment Strategy

### 9.1 Deployment Targets

Because a Thirai workspace is static assets plus optional REST backends, every mainstream target is supported with its native tooling: local filesystem, IIS, Apache, Nginx, Docker (an nginx image with the workspace mounted), Azure (Static Web Apps / App Service / Blob+CDN), AWS (S3+CloudFront / ECS), Kubernetes (any static-serving container behind an ingress), and on-premise servers. The only host requirement for clean URLs is a rewrite rule sending unknown paths to `index.html`; a fallback hash-routing mode exists for hosts that cannot rewrite.

### 9.2 Deployment Flow

```
Package (.tpk)
   ↓
Validate          checksums · descriptor · framework compatibility · governance gate
   ↓
Deploy            copy to applications/ · register with Registry
   ↓
Health Check      manifest loads · routes resolve · datasources reachable · diagnostics green
   ↓
Publish           governance flips published=true · route goes live
```

Each transition is recorded in `deployments/deployment.log.json`. A failed health check halts the flow with the application still unpublished — users never see a half-deployed application.

### 9.3 Rollback

Rollback is first-class: previous package versions remain in `packages/`, and rollback is simply the deployment flow run against the prior version, completing in seconds because nothing is built. The deployment log records the rollback, its reason, and its actor.

---

## 10. Scalability Strategy

### 10.1 Scaling Across Applications (1 → 1000)

Application isolation is the core mechanism. Each application has its own namespace in the registry, its own folder, its own logs, and no shared mutable state with any other application. Page metadata for an application loads only when its route is visited — the registry holds lightweight summaries, so 1000 registered applications cost kilobytes at boot, not megabytes. A failure inside one application (a broken workflow, an unreachable datasource) is contained by the error envelope and cannot disturb another application's routes, pages, or data.

### 10.2 Scaling Across Users (10 → 100,000)

The runtime is stateless and the assets are static, so user scaling is an infrastructure exercise, not a framework exercise: add a CDN, add cache headers (packages are immutable per version, making them perfectly cacheable), and scale REST backends independently. The framework adds no per-user server state of its own.

### 10.3 Scaling Across Infrastructure

The same workspace, byte for byte, runs on a single server, behind a load balancer (no sticky sessions needed — there are no sessions), in containers, in a cluster, or cloud-native behind a CDN. Promotion between environments is file synchronization plus environment descriptors in `deployments/environments/` — never a rebuild.

---

## 11. Diagnostics & Supportability Strategy

### 11.1 Diagnostics Surfaces

Every application exposes a diagnostics document, available at `/{route}/thirai/diagnostics` (governed: enabled per environment) and via the framework console:

```json
{
  "application": "attavanai",
  "version": "1.0.0",
  "status": "healthy",
  "checkedAt": "2026-06-12T10:42:11Z",
  "checks": {
    "manifest":    { "status": "healthy" },
    "routes":      { "status": "healthy", "registered": 4 },
    "templates":   { "status": "healthy", "resolved": 2 },
    "datasources": { "status": "degraded", "detail": "pricing-api: 2 timeouts in last 5 minutes" },
    "workflows":   { "status": "healthy", "executions": 17, "failures": 0 }
  }
}
```

The framework itself exposes `/thirai/diagnostics` (engine health, boot timings, registry counts) and `/thirai/registry` (read-only registry browser). Status values are exactly three: `healthy`, `degraded`, `unhealthy` — no ambiguity.

### 11.2 The Error Envelope

Every error in Thirai — engine, page, datasource, or workflow — is wrapped in a single structured envelope before it surfaces anywhere:

```json
{
  "application": "Attavanai",
  "workflow": "GenerateTimetable",
  "step": "TeacherAllocation",
  "reason": "Missing Teacher Assignment",
  "detail": "Class 6-B period 3 has subject 'Tamil' with no teacher assigned in the input.",
  "remedy": "Assign a teacher to Tamil for Class 6-B, or mark the period as unassigned.",
  "code": "THIRAI-WF-1042",
  "at": "2026-06-12T10:41:58Z",
  "correlationId": "c1f3-..."
}
```

The contrast this enforces:

```
Bad:   Unhandled Exception
Good:  Application: Attavanai
       Workflow: GenerateTimetable
       Step: TeacherAllocation
       Reason: Missing Teacher Assignment
```

Every error has a stable code (catalogued in framework documentation), a human-readable reason, and — wherever the engine can know it — a remedy. Errors are written to `logs/applications/{id}/` as JSON lines and shown to developers/support in the same shape. A support engineer reads the envelope, the diagnostics document, and the audit log — and never needs the source.

---

## 12. Thirai IDE Readiness

Thirai IDE (the low-code/no-code development environment built on the framework) is a consumer of the framework, not a privileged extension of it. Everything Thirai IDE needs already exists by design:

| Thirai IDE module | Framework capability it consumes |
|---|---|
| Application Designer | Manifest schema + Registry registration API |
| Page Designer | Page metadata schema + Template region descriptors |
| Form Designer | Form Page template + datasource bindings |
| Workflow Designer | Workflow schema + step-type catalog from the Registry |
| Datasource Designer | Datasource schemas + connector type registry |
| Package Builder | `.tpk` layout + checksum/descriptor format |
| Deployment Manager | Deployment flow + deployment log + environment descriptors |
| Governance Console | Policy schemas + audit log + registry queries |

Because every artifact Thirai IDE edits is plain JSON validated by published schemas, and every runtime capability is discoverable through the Registry and diagnostics endpoints, Thirai IDE requires no framework changes — it generates, validates, and packages the same metadata a developer writes by hand. Hand-written and IDE-built applications are indistinguishable to the platform.

---

## 13. Sample Implementation — Attavanai Walkthrough

This section traces one request through the full architecture to make the design concrete.

**The artifacts.** Attavanai ships as `attavanai-1.0.0.tpk` containing the manifest from §5.3, the `home` page from §5.4, the `generate-timetable` workflow from §5.7, two datasources, and its assets.

**Deployment.** Operations drops the package into `packages/` and runs install. Checksums verify; the governance deployment gate confirms the route `/products/attavanai` is unique and the naming policy passes; files copy to `applications/attavanai/`; the Registry registers the application, four pages, one workflow, and two datasources atomically; the health check loads the manifest, resolves every route, and pings the pricing API; governance flips `published: true`. Total elapsed time: seconds.

**A user visits `/products/attavanai`.** The Router normalizes the URL and finds the route in the Registry. The runtime governance gate confirms the application is published. The Page Engine loads `home.page.json`, asks the Registry for `product-template`, and renders: the hero region receives literal text, the features region declares `"datasource": "features"`, so the Datasource Engine fetches the JSON (cache: session) and the region repeats per item. The page is visible; `page:rendered` fires; the diagnostics heartbeat records a healthy render in 38 ms. The user saw a fast product page and a clean URL — and nothing else.

**A workflow fails.** A school admin triggers Generate Timetable with an incomplete input. The `validate` step's rules detect a class period with no teacher. The Workflow Engine halts, constructs the error envelope from §11.2 automatically (it knows the application, workflow, step, and the rule that failed), logs it, and the form page renders the reason and remedy. The support engineer who receives the ticket reads code `THIRAI-WF-1042` and the remedy line — case closed without opening a single source file.

---

## 14. Implementation Specification

This section defines how the framework itself is built — coding standards, the kernel contract, the engine module pattern, and the delivery phases. It is binding for framework contributors and for Thirai IDE code generation.

### 14.1 Coding Standards

The framework is written in ES6+ JavaScript as native browser modules (`<script type="module">`). There is no transpilation, no bundling, and no third-party runtime dependency — the forbidden list in §2.4 applies to the framework's own source, not only to applications. Each engine is a single file with a size budget: the kernel under 500 lines, each engine under 800 lines. All public functions carry JSDoc comments. Every thrown error is a `ThiraiError` carrying the envelope fields from §11.2 — bare `throw new Error(...)` is forbidden in framework code. Strict mode, `const` by default, no `eval`, no `innerHTML` with unsanitized input (template rendering uses `textContent` and attribute assignment).

### 14.2 Bootstrap — index.html

The entire platform boots from one static page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loading…</title>
  <link rel="stylesheet" href="framework/styles/thirai-base.css">
</head>
<body>
  <main id="thirai-root"></main>
  <script type="module" src="framework/kernel/thirai-kernel.js"></script>
</body>
</html>
```

### 14.3 Kernel Contract

The kernel exposes exactly four capabilities to engines:

```javascript
// framework/kernel/thirai-kernel.js — public surface
export const kernel = {
  config,                        // frozen object from thirai.config.json
  events: {                      // synchronous pub/sub bus
    publish(topic, payload) {},
    subscribe(topic, handler) {} // returns unsubscribe function
  },
  registry: null,                // set by Registry Engine at boot; read-only thereafter
  error(fields) {}               // constructs a ThiraiError with the §11.2 envelope
};
```

Boot order is declared in `thirai.config.json`, not hard-coded:

```json
{
  "framework": { "version": "1.0.0" },
  "boot": ["registry", "manifest", "governance", "router",
           "template", "page", "datasource", "workflow", "diagnostics"],
  "applicationsPath": "applications/",
  "diagnostics": { "enabled": true, "heartbeatSeconds": 30 }
}
```

### 14.4 Engine Module Pattern

Every engine exports the same shape, which is what makes engines replaceable (Principle 8):

```javascript
// framework/engines/router.engine.js
export default {
  id: "router",
  version: "1.0.0",

  /** Called once at boot, in config-declared order. */
  async start(kernel) {
    // subscribe to events, perform registry lookups, attach listeners
  },

  /** Must answer in < 50 ms with no side effects. */
  diagnostics() {
    return { status: "healthy", routes: 12, lastResolutionMs: 4 };
  },

  /** Graceful shutdown / hot-replace support. */
  async stop() {}
};
```

The kernel loads each engine via dynamic `import()`, calls `start(kernel)`, and registers its `diagnostics()` with the Diagnostics Engine. An engine that fails to start halts boot with a structured error naming the engine, the phase, and the reason.

### 14.5 Representative Render Path (Page + Template)

The complete render mechanism, illustrating the no-virtual-DOM approach:

```javascript
// inside page.engine.js — simplified
async function render(pageMeta) {
  const tpl = kernel.registry.get("template", pageMeta.template);
  const fragment = tpl.element.content.cloneNode(true);

  for (const [name, binding] of Object.entries(pageMeta.regions)) {
    const region = fragment.querySelector(`[data-thirai-region="${name}"]`);
    if (!region) throw kernel.error({ reason: `Region '${name}' not in template '${tpl.id}'` });

    if (binding.datasource) {
      kernel.events.publish("datasource:fetch", { id: binding.datasource, region });
    } else if (binding.content) {
      region.append(await loadSanitizedContent(binding.content));
    } else {
      bindLiterals(region, binding);   // textContent + attribute assignment only
    }
  }

  document.getElementById("thirai-root").replaceChildren(fragment);
  kernel.events.publish("page:rendered", { page: pageMeta.id });
}
```

One render per navigation; datasource updates later touch only their own region. No diffing, no re-render cycle, no hidden lifecycle.

### 14.6 Delivery Phases

| Phase | Scope | Exit criterion |
|---|---|---|
| 1 | Kernel + Registry + Router | A registered route resolves and logs diagnostics |
| 2 | Manifest + Page + Template engines, six base templates | A metadata-only application renders end to end |
| 3 | Datasource Engine (json/rest/static) | Regions bind live data with fallback on failure |
| 4 | Workflow Engine + step handlers | Generate-timetable sample runs with envelope errors |
| 5 | Governance + Diagnostics engines, audit log | All three gates enforce policies; `/thirai/diagnostics` live |
| 6 | Packaging (`.tpk`) + deployment tooling + rollback | Install → health check → publish → rollback cycle proven |
| 7 | Thirai IDE foundations | IDE round-trips an application it did not create |

Each phase ships independently testable artifacts; no phase requires rework of a previous phase's contracts.

---

## 15. Hardening Charter — Security, Lightweight, Supportability

This section is **normative and binding**. The three commitments below are not aspirations; they are enforced by the Thirai Verifier (§15.4), which **hard-fails** the build, packaging, and deployment if any budget or rule is violated. A failing verifier blocks the pipeline — there is no override flag (Principle 6: governance is built in, not opt-in).

The motivation is explicit. Mainstream frameworks ship hundreds of transitive dependencies as opaque, minified bundles — you cannot audit what you cannot read, which is the root of most supply-chain vulnerabilities. They also duplicate the DOM in a virtual tree and retain large object graphs, consuming far more client memory than the page itself requires. Thirai rejects both. Every byte that runs is a file a human can open, like a standard library rather than a bundle; and the framework's own footprint is measured and capped.

### 15.1 Pillar A — Security & Anti-Black-Box

**A1. Zero runtime dependencies.** The framework and applications load *only* relative-path ES modules from within the workspace. No npm packages, no CDNs, no remote scripts at runtime. The verifier scans every `import` statement and fails on any specifier that is not a relative path (`./` or `../`).

**A2. Readable, not bundled.** No minification, no transpilation, no bundling of framework or application code. The file on disk is the code that runs, line for line. This is the auditability guarantee.

**A3. Content Security Policy, enforced.** Every Thirai page is served under a strict CSP that forbids inline scripts, `eval`, and unapproved origins. The baseline policy (§15.5) is emitted into `index.html` and is verifier-checked; the Governance Engine (Phase 5) tightens `connect-src` to exactly the datasource allow-list.

**A4. Datasource allow-list.** REST datasources may call *only* origins on the governance allow-list (`governance/policies/datasources.policy.json`). An undeclared origin is a registration-time failure, and CSP blocks it at runtime as defense in depth.

**A5. Content sanitization.** Static content fragments are sanitized before insertion: `script`, `iframe`, `object`, `embed`, `form`, `link`, `meta`, `base` tags removed; `on*` handlers and `javascript:` URLs stripped. Rendering uses `textContent` and attribute assignment only — never `innerHTML` with unsanitized input.

**A6. Integrity & provenance.** Every `.tpk` package carries SHA-256 checksums per file; install verifies them. The dependency surface is fully enumerable: the verifier emits a manifest of every file the framework loads, so security review has a complete, finite list.

### 15.2 Pillar B — Lightweight (Measured, Not Claimed)

A framework cannot honestly promise "10–20% of a machine's RAM," because total memory is dominated by *application* content — images, data, the app's own DOM — not the framework. What Thirai promises and enforces is a tiny **framework overhead**, measured every build. The architecture earns this structurally: **no virtual DOM** means no shadow tree duplicating the real DOM in memory (a major source of mainstream frameworks' footprint), and **lazy page loading** means only the visited page's metadata is resident.

**Enforced budgets (hard-fail at build):**

| Budget | Limit | Rationale |
|---|---|---|
| Total framework JS (uncompressed) | ≤ 150 KB | Entire 9-engine platform; React+ReactDOM runtime alone is ~140 KB *gzipped* |
| Total framework JS (gzipped, over-the-wire) | ≤ 45 KB | What the client actually downloads |
| Total framework CSS | ≤ 20 KB | Framework chrome only; apps bring their own |
| Kernel file | ≤ 500 lines / ≤ 20 KB | Spec §14.1 |
| Any single engine file | ≤ 800 lines / ≤ 20 KB | Spec §14.1 |
| Per-application page metadata | ≤ 64 KB | Keeps lazy page loads cheap |

**Measured runtime metrics (reported in diagnostics; deploy gate may hard-fail on a captured baseline):**

| Metric | Target | Source |
|---|---|---|
| Framework heap overhead | ≤ 5 MB | `performance.memory` where available |
| Per-navigation render | ≤ 100 ms | Page Engine timing (§14.5) |
| Detached-node retention | 0 | No VDOM; one render per navigation |
| Boot time (cold) | ≤ 250 ms | Kernel boot report |

Comparative honesty: the budget governs *framework overhead*, and applications remain responsible for their own asset weight. Guidance for application authors (lazy images, sized assets, paginated data) ships in the developer documentation, but the framework's contribution to client memory stays under the caps above, verifiably.

### 15.3 Pillar C — Supportability

**C1. Self-check battery.** The Diagnostics Engine (Phase 5) runs a battery of self-checks at boot and on demand, each returning `healthy | degraded | unhealthy` with a sentence-form reason — never a bare status. The kernel provides the core surface today via `window.thirai.diagnostics()`.

**C2. Every error is a remedy.** Every `ThiraiError` carries application/engine/workflow/step, a human reason, a stable code, and — wherever knowable — a remedy (§11.2). Bare `throw new Error` is forbidden and verifier-checked in framework code.

**C3. Support bundle.** A single command (`window.thirai.support()` at runtime; `thirai support` in tooling) produces one JSON document containing diagnostics, the registry snapshot, recent structured logs, the event trace, and redacted config. A support engineer reads this bundle and resolves the issue **without source-code access** — the founding promise of the platform.

**C4. Structured logs.** All logs are JSON lines with timestamp, level, source, message, and optional data — grep-able, shippable, never free-text-only.

### 15.4 The Thirai Verifier (Enforcement)

`thirai-verify` is the offline, build-time counterpart to the Governance Engine. It is **operational tooling**, not part of the client runtime: it ships **zero bytes to the browser**, has **zero dependencies** (pure Node standard library, so it is as auditable as everything else), and it does not transform, bundle, or minify anything — it only **inspects and gates**. This is fully consistent with the no-build-pipeline philosophy: the verifier reads files and says yes or no.

It runs at three gates and **hard-fails** (non-zero exit) on any violation:

| Gate | Invocation | Effect of failure |
|---|---|---|
| Build / CI | `node tools/thirai-verify.mjs` | Blocks merge / build |
| Packaging | invoked by the `.tpk` builder | Refuses to produce the package |
| Deployment | invoked by the deployment flow (§9.2) | Refuses to deploy / publish |

Checks performed: dependency purity (A1), no-bundling heuristics (A2), CSP presence and strictness (A3), datasource allow-list integrity (A4), forbidden `throw new Error` in framework code (C2), forbidden-directory absence (`components/`, `hooks/`, `stores/`, etc.), and every size budget in §15.2. Budgets are **data, not code** — defined in `governance/budgets.json` so they are reviewable and versioned like any governed artifact.

### 15.5 Baseline Content Security Policy

Emitted into `index.html` and verifier-enforced. `connect-src` starts closed and is widened only by the datasource allow-list:

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

No `'unsafe-inline'`, no `'unsafe-eval'`, no wildcard origins — ever. These remain forbidden by Principle 10.

---

## 16. Roadmap & Open Items

**v1 (this document).** Nine engines, six framework templates, JSON/REST/static datasources, `.tpk` packaging, three-gate governance, diagnostics and error envelope.

**v1.x.** Package signing enforcement, environment-aware datasource overrides, workflow step-type extension API (the registered-extension path for custom handlers), localization metadata. The Hardening Charter (§15) is enforced from Phase 6 onward via the Thirai Verifier.

**v2 / Thirai IDE era.** SQL, SAP, and custom datasource connectors; Thirai IDE modules consuming the APIs in §12; multi-workspace federation for very large enterprises.

**Explicit non-goals, permanently.** Virtual DOM, component model, client-side state stores, build pipelines, and transpilation. These remain forbidden by Principle 10 — the framework's value is precisely that it never acquires them.

---

*End of document. All metadata examples in this specification are normative; engines must accept them as written.*
