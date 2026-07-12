# Thirai — Architecture Direction (handoff brief)

Compact context for continuing the structural redesign in a fresh chat.
This is an agreed *direction*, **not yet applied** to the spec or code.

## Anchors
- Spec: `SPECIFICATION v1.md` (metadata-driven, static, vanilla-JS platform; no build, no npm, no VDOM).
- Code: `framework/code/` (9 engines under `framework/code/framework/engines/`).
- Verified fixes in flight: `FIX-BRIEF.md` (C1–C4). C1 = app-scoped workflow handlers — the isolation precedent we reuse below.
- Host: LOCALSERVER = generic, Thirai-agnostic host; serves the document root, keeps operational folders private.

## Decisions reached

**1. Two roots — don't conflate them.**
- *Repo source*: `code/`, `docs/`, `release/`.
- *Document root* (= `public_html`, the served thing): `index.html` + `framework/` + `governance/policies/` + the app.
- Operational artifacts (`.tpk` packages, deploy/audit records) live **outside** the served root. **No logs in the document root.**

**2. Framework = mechanism only.**
- Keep the template/page/datasource **engines** in `framework/`.
- Move the concrete template **assets** (the 6 baked skeletons) **out** into the shared **`modules/`** library. **No separate `templates/` tier** — a template is a *module* (skeleton HTML + a loader fn invoked by name); the template **engine stays core**. Templates sit *on top of* the framework, not within it.

**3. App = metadata, not scripts.**
```
{app}/
  manifest.json     identity + route (its `entry` = the app's landing page → FIX C2)
  pages/            page METADATA (the "what")
  data/             datasources + content
  styles/           app CSS
  handlers/         the ONLY app-authored JS (workflow step handlers)
  assets/           images/fonts/media
  my-child-apps/    optional — nested apps; parent governs them, routes compose in (see #4)
  my-child-sites/   optional — nested sites; each owns its governance + identity (see #4)
```
`scripts/` is a trap → it's `pages/` (metadata) + `handlers/` (thin JS). Nothing else executable.

**4. Recursive parent/child tree — two nesting kinds.**
- Always exactly **one parent app**, served at `/` (the portal/home). Same anatomy, recursively.
- A parent holds two peer collections — the split is the **governance boundary**:
  - *child-app* (`my-child-apps/`): shares the parent's governance owner; composes **into** the parent's route namespace. Internal sub-app.
  - *child-site* (`my-child-sites/`): its **own** governance owner + manifest identity; mounted at a sub-path as the root of its own subtree. Crossing a site boundary **flips the governance owner**.
- Registry stays **flat + `parent` pointer** (O(1) lookup, Principle 2). Disk nesting = ownership; the manifest still declares the route; disagreement **rejects at registration** (no silent winner — same rule as C1/C2).
- Routes compose down the tree. Single-app = the degenerate tree (one parent at `/`, zero children).
- **Disk layout:** the parent app is a lowercase-kebab folder at the document root (e.g. `my-app/`, renamed per project — the id must match, so no `MyApp`). The **root's** `my-child-apps/` + `my-child-sites/` are **document-root siblings** of the parent folder; every **deeper** app nests its collections inside its own folder. Each collection carries an explicit index (`my-child-apps.json` / `my-child-sites.json`) since static hosting can't list dirs. Registry records per app: `parent`, `governanceOwner`, `kind` (root/child-app/child-site), `basePath`.

**5. Stateless runtime — session logs only.**
- Framework **writes no files, stores nothing.** Spec **line 637** ("errors written to `logs/applications/{id}/`") is wrong — strike it.
- Runtime telemetry = in-memory ring buffer + optional `sessionStorage` mirror; dies with the session. `window.thirai.diagnostics()` / `support()` read live from it.
- Persistence is an **app concern only**: an app that needs durable logs declares a write-capable REST datasource (allow-listed + CSP), forwards its own stream. Off by default.
- The enterprise **audit trail** (§7/§9) is a **tooling-plane** artifact (deploy/registration tools have a filesystem) — not runtime. So "stores nothing" doesn't kill compliance.

**6. Reusable JS ("modules") — three planes.**
- *Engine* (already core): **API Manager = the datasource engine** (sole governed `fetch()`, allow-list, open connector model). **Page Builder = page+template engine.** Don't rebuild these.
- *Module* (shared registered JS in `modules/`): connectors, field/widget renderers, formatters/validators, **and templates** (skeleton HTML + loader fn — the only `modules/` entry that carries assets).
- *Studio* (authoring UIs): Formbuilder, Page Builder as drag-drop tools → they **emit metadata**, not runtime code.
- How modules enter: **generalize the existing `handlers.js` → `api.register(name, fn)` pattern** (`workflow.engine.js:115-137`). Relative-path ES module (A1), **invoked by name from metadata** (never `import`ed by pages), **app-scoped + duplicate-rejecting** (C1 discipline), **stateless / per-app** (no shared mutable singletons = C1 bug in library form), **side-effects only through governed engines** (no rogue fetch/storage).

**7. Packaging = closure only.**
- `.tpk` and the browser test bundle include **only** the modules/templates/handlers the app actually references. **Selection, not transformation** — stays no-build-compliant.

## Resolved forks (2026-07-12)
- **Nesting:** two peer collections — `my-child-apps/` (parent-governed, route composes in) and `my-child-sites/` (self-governed, own identity, root of its own subtree). App ≠ site = the governance boundary. The single root's collections are **document-root siblings** of the parent app folder (e.g. `my-app/`); deeper apps nest theirs.
- **Library:** one `modules/` tier; **no** top-level `templates/`. A template is a module (skeleton assets + loader fn); core `template.engine.js` stays as mechanism.
- **Log persistence:** client-only by default (in-memory ring + optional `sessionStorage`); ship-to-sink is **per-app opt-in** via a governed write-capable datasource. Framework stores nothing.
- **Topology:** fully recursive on disk; flatness lives **only** in the registry (flat + `parent` pointer). Single-app = degenerate tree.

## Spec-delta targets (when we apply)
- §4.1 Workspace Layout → two roots + recursive parent/child + operational-outside-docroot.
- §4.3 Application Anatomy → pages/data/styles/handlers/assets/my-child-apps/my-child-sites; drop `scripts`.
- §5.5 Template Engine → engine stays core; skeletons become a module's assets (no separate `templates/` tier).
- §7 Governance → audit trail is tooling-plane.
- §10 Scalability → multi-app via recursive tree; child-sites = governance boundary / host mounting, not flat `applications/`.
- §11 line 637 → strike file-writing; session-only logs.
- §16 / new section → `modules/` tier + register surfaces (connectors/widgets/formatters/templates) + packaging closure.
