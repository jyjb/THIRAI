<!--
  THIRAI — Gap Fix Directive
  Repository location: docs/FIX-BRIEF.md
  Sources reconciled: (1) the eleven-point vision / ten principles, and
  (2) the ACTUAL CODE as verified by AUDIT_v2.md (file:line evidence).
  NOT based on any prose summary of the code — only on AUDIT_v2's verified findings.

  Scope: four code fixes (C1–C4) with verified file:line anchors and the
  founder's chosen resolution for each. The Principle-8 wording amendment is a
  SPEC edit, handled separately (see FIX-BRIEF note at the end).

  Discipline for whoever executes this (same as the audits):
  - Read the cited file:line and confirm the finding still holds BEFORE editing.
    AUDIT_v2's line numbers may have drifted; re-locate by content, not line number.
  - Every fix ends with a verification step. Do not mark a fix done without it.
  - After all four, re-run the project's verifier — it must stay green.
  - Do not "improve" adjacent code. Fix exactly these four, nothing else.
-->

# THIRAI — Fix the Four Verified Gaps

Execute in this order. **C1 first — it is the only isolation breach and isolation is load-bearing (Principle 7 / vision P9).**

---

## FIX 1 — C1: namespace workflow handlers per app (isolation breach)

**Gap (verified, AUDIT_v2 C1):** `registerHandler` stores handlers in one process-wide map keyed by raw name, no app prefix, no duplicate check — `workflow.engine.js:115-124`; `resolveStepHandler` reads it globally — `workflow.engine.js:185-188`. Two apps registering the same handler name (e.g. `"process"`) silently cross-wire: whichever loads later in `applications.json` wins, and the other app's step runs the wrong function. This violates application isolation with no error.

**Reconciliation:** the principle (absolute isolation) is right; the code is wrong. Fix the code.

**Change:**
1. Key the handler map by `appId + "/" + name` instead of raw `name`. Datasources already namespace by `appId/id` (`datasource.engine.js:28-29`) — mirror that exact pattern for consistency.
2. In `registerHandler`, reject a duplicate key with a structured `ThiraiError` (application, step `RegisterHandler`, a new code e.g. `THIRAI-WF-xxxx`, reason naming the collision, remedy "rename the handler or check for a duplicate registration"). No silent overwrite.
3. In `resolveStepHandler`, look up by the app-scoped key — the resolving app's id is already in scope during workflow execution; use it. A missing handler must produce a structured error, not `undefined`.
4. Update the sample app registration path if it registers bare names (`applications/attavanai/workflows/handlers.js:13` uses a convention prefix like `"attavanai.allocateTeachers"` — confirm the new scoping composes correctly with that, and simplify if the appId scoping makes the manual prefix redundant).

**Verify:** create a second sample app whose `handlers.js` registers a handler with the SAME bare name as attavanai's. Boot both. Confirm (a) registration now either scopes them apart so both work, or rejects the duplicate with the structured error — not a silent last-wins — and (b) each app's workflow step runs ITS OWN handler. Cite the observed behavior.

---

## FIX 2 — C2: honor `manifest.entry` (make the declaration real)

**Gap (verified, AUDIT_v2 C2):** every manifest declares `entry` (`applications/attavanai/manifest.json:9`) but nothing reads it — a whole-tree grep finds zero reads. The landing page is actually chosen by the `path === ""` convention (`page.engine.js:416-419`). Declared metadata that drives nothing = hidden behavior (Principle 9 / vision P6).

**Chosen fix: HONOR `entry`** — make it select the landing page, as a reader would expect.

**Change:**
1. In the page-resolution path (`page.engine.js` around `:416-419`), when resolving the app root (empty sub-path), select the page whose id/file matches `manifest.entry` instead of relying solely on `path === ""`.
2. Validate at registration (Manifest Engine) that `entry` names a real declared page — if `entry` points at a page id/file that isn't in the app's `pages.json`, reject with a structured error at the registration gate, not at first navigation. (Manifest Engine already format-validates fields near `manifest.engine.js:75-79` — add the referential check there.)
3. Decide the precedence rule explicitly and document it in the spec: does `entry` override `path:""`, or must they agree? Recommend: `entry` is authoritative for the landing page; `path:""` may be removed or kept as a redundant hint — but they must not disagree silently. If both are present and conflict, reject at registration (no silent winner — that would re-introduce the same class of bug as C1).

**Verify:** set `entry` to a NON-default page (e.g. a dashboard page that does not have `path:""`). Boot the app at its root route. Confirm it opens on the `entry` page. Then set `entry` to a non-existent page id and confirm registration fails with a structured error. Cite both.

---

## FIX 3 — C3: reserve the `/thirai/` namespace at the registration gate

**Gap (verified, AUDIT_v2 C3):** `/thirai/...` and per-app `/{route}/thirai/diagnostics` are intercepted by literal prefix checks before the route table is consulted (`router.engine.js:85`, `:119`), yet the manifest route pattern permits an app to own such a route (`manifest.engine.js:24`, regex `/^\/[a-z0-9\-/]+$/` matches `/thirai/foo`). An app registered at `/thirai/reports` passes registration but is permanently unreachable — the router treats it as a framework view. The reserved namespace is invisible in config and registry (Principles 2, 9, 10 / vision P6, P11).

**Chosen fix: REJECT apps that try to own `/thirai/*` at registration.**

**Change:**
1. Add a rule to the route governance policy (`governance/policies/` — the routes policy) that reserves the `thirai` top-level route segment.
2. Enforce it at the **registration gate** in the Governance Engine (where naming/route violations are already thrown, `governance.engine.js:100-141`): if a manifest route is `/thirai` or begins with `/thirai/`, reject with a structured `ThiraiError` — reason "the `/thirai` route namespace is reserved by the framework", remedy "choose a route outside `/thirai`". Fail at registration, never silently at navigation.
3. Make the reserved segment a single named constant/policy value, not a magic string duplicated across router and governance — so the reservation is declared in one governed place (this also answers the Principle-10 "no magic" concern the finding raised).

**Verify:** add a sample app with route `/thirai/reports`. Boot the workspace. Confirm it is REJECTED at registration with the structured error (and the other apps still load — isolation). Cite the error output. Confirm a normal route (e.g. `/products/foo`) still registers fine.

---

## FIX 4 — C4: enforce framework `minVersion` at registration

**Gap (verified, AUDIT_v2 C4):** `manifest.framework.minVersion` is only format-validated (`manifest.engine.js:75-79`); nothing compares it to the running version. `config.framework.version` is never read — the running version is the hardcoded constant `FRAMEWORK_VERSION` (`thirai-kernel.js:18`). An app declaring `minVersion: "2.0.0"` runs on a 1.0.0 runtime with no signal (Principle 6 / vision P3). This also resolves AUDIT_v2's M1 (inert `config.framework.version`).

**Reconciliation:** governable principle is right; the check is missing. Add it.

**Change:**
1. In the Manifest/Registry registration path, after format-validating `minVersion`, compare it against `kernel.version` using a semver comparison. If the runtime is older than `minVersion`, reject the app with a structured `ThiraiError` — reason "app requires framework >= X but runtime is Y", remedy "upgrade the framework runtime or lower the app's minVersion". Reject at registration (fail fast), consistent with C3's gate placement.
2. **Decide the source of truth for the running version and make it singular** (this closes M1): either the kernel constant `FRAMEWORK_VERSION` is authoritative and `config.framework.version` is REMOVED from the config (no inert key), OR `config.framework.version` becomes authoritative and the kernel reads it. Do not keep both. Recommend: keep the kernel constant as authoritative (a config file shouldn't be able to lie about the runtime's own version) and delete `framework.version` from `thirai.config.json` so no inert metadata remains.

**Verify:** set a sample app's `minVersion` to a version higher than the runtime constant. Boot. Confirm registration is rejected with the structured version error while compatible apps load. Then confirm `thirai.config.json` no longer carries an inert `framework.version` key (or, if you chose the other direction, that editing it actually changes the reported version). Cite both.

---

## After all four

1. Re-run the project verifier — it must stay green (and should now pass the privacy/hidden-behavior checks with fewer inert-metadata items).
2. Update `AUDIT_v2.md`'s findings section (or append a `FIX-LOG.md`) marking C1–C4 as resolved, with the new file:line of each fix and the verification result.
3. Confirm no NEW inert metadata or magic strings were introduced by the fixes themselves.

## Separate — the Principle-8 wording (SPEC edit, not code)

AUDIT_v2's category-c finding: Principle 8's "communicate only through events and registry" is overstated — engines also couple through named kernel services (`kernel.templates`, `kernel.governance`, …), which spec §14.3 sanctions. The chosen resolution is to **amend the principle to describe the real design**, not change the code. That amendment is a spec text edit and is provided separately — apply it to `docs/SPECIFICATION.md` so the principle and the code finally agree.
