/*
 * Thirai Verifier (spec §15.4) — the offline, build-time enforcement gate AND
 * privacy guardian. Native C# / .NET 10, BCL only, ZERO third-party
 * dependencies, ships ZERO bytes to the browser. It does not transform, bundle
 * or minify anything: it inspects files and says yes or no, hard-failing
 * (non-zero exit) on any violation. There is no override flag (spec §15).
 *
 * Privacy posture of the tool itself (Tooling Brief Directive 0):
 *   - Zero network I/O. There is no HTTP client anywhere in this program.
 *   - Deterministic: same input -> identical output, byte for byte.
 *   - No developer-machine leakage: every path in any output is
 *     workspace-relative; no usernames, hostnames, env vars, home dirs or
 *     timestamps are emitted.
 *   - Minimal writes: console-only unless --report <path> is passed, in which
 *     case it writes exactly that one JSON file and nothing else. It never
 *     persists any scanned source.
 *
 * Enforcement checks (spec §15.4, carried over from the legacy Node verifier):
 *   A1  dependency purity         every import is a relative-path ES module
 *   A2  no bundling/minification  readable source, no source maps, no .min.js
 *   A3  CSP presence & strictness in index.html; connect-src == allow-list
 *   A4  datasource allow-list     every REST origin is on the allow-list
 *   C2  no bare built-in throw     no `throw new Error/TypeError/...`
 *       forbidden directories      components/hooks/stores/... absent
 *       size budgets               every budget in governance/budgets.json
 *   A6  dependency surface         enumerated and reported (finite, auditable)
 *
 * Privacy-guardian checks (NEW — the priority), driven by governed data in
 * governance/privacy.policy.json (falls back to budgets.json if absent):
 *   PRIV-LOG     runtime logs must stay in memory (never persisted to disk)
 *   PRIV-PERSIST no localStorage/sessionStorage/cookies/IndexedDB in framework
 *   PRIV-NET     no external calls from framework core
 *   PRIV-CDN     no third-party tracking/CDN references in markup/assets
 *
 * Usage:  thirai-verify [workspaceRoot] [--report <path>]
 * Exit:   0 = all checks pass  ·  1 = one or more violations  ·  2 = bad usage
 */

using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Thirai.Verify;

internal static class Program
{
    // Directories the runtime never loads from — skipped when walking the tree.
    private static readonly HashSet<string> SkipDirs = new(StringComparer.Ordinal)
        { "node_modules", ".git", "packages", "release", "deployments", "logs", "bin", "obj" };

    private static readonly List<string> Failures = new();
    private static readonly List<string> Warnings = new();
    private static readonly List<string> Report = new();
    private static readonly List<BudgetLine> Budgets = new();

    private static string _root = "";
    private static double _sizeWarnTolerancePct;

    private static void Fail(string check, string msg) => Failures.Add($"{check}: {msg}");
    private static void Warn(string check, string msg) => Warnings.Add($"{check}: {msg}");

    private static int Main(string[] args)
    {
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

        // ---- parse args: [workspaceRoot] [--report <path>]
        string? rootArg = null;
        string? reportPath = null;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--report")
            {
                if (i + 1 >= args.Length) { Console.Error.WriteLine("--report requires a path."); return 2; }
                reportPath = args[++i];
            }
            else if (rootArg is null) rootArg = args[i];
            else { Console.Error.WriteLine("Unexpected argument: " + args[i]); return 2; }
        }

        _root = ResolveWorkspaceRoot(rootArg);
        if (_root is "")
        {
            Console.Error.WriteLine("Could not locate a Thirai workspace (a directory containing " +
                "governance/budgets.json and framework/). Pass the workspace root explicitly.");
            return 2;
        }

        var budgets = LoadJson(Path.Combine(_root, "governance", "budgets.json"));
        if (budgets is null) { Console.Error.WriteLine("governance/budgets.json is missing or invalid."); return 2; }

        Console.WriteLine("Thirai Verifier (.NET) — workspace: " + Rel(_root));

        EmitSurface();
        CheckDependencyPurity();
        CheckNoBundling();
        CheckCsp();
        CheckDatasourceAllowList();
        CheckNoBareThrow();
        CheckForbiddenDirectories(budgets.Value);
        CheckBudgets(budgets.Value);
        RunPrivacyChecks();

        // ---- output
        foreach (var line in Report) Console.WriteLine(line);
        if (Warnings.Count > 0)
        {
            Console.WriteLine("\nWarnings:");
            foreach (var w in Warnings) Console.WriteLine("  ! " + w);
        }

        if (reportPath is not null) WriteReport(reportPath);

        if (Failures.Count > 0)
        {
            Console.WriteLine($"\nFAILED ({Failures.Count} violation{(Failures.Count == 1 ? "" : "s")}):");
            foreach (var f in Failures) Console.WriteLine("  x " + f);
            Console.WriteLine("\nThe verifier hard-fails the pipeline — there is no override flag (spec §15).");
            return 1;
        }

        Console.WriteLine("\nAll checks passed. Zero violations.");
        return 0;
    }

    /* ------------------------------------------------------------------ *
     *  Workspace-root resolution (no absolute path ever leaves the tool)
     * ------------------------------------------------------------------ */

    private static string ResolveWorkspaceRoot(string? arg)
    {
        if (arg is not null)
        {
            var full = Path.GetFullPath(arg);
            return LooksLikeWorkspace(full) ? full : full; // honour explicit arg as given
        }
        // Auto-detect: walk up from the executable, then from the CWD, looking for
        // a directory that has both governance/budgets.json and framework/.
        foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            var dir = new DirectoryInfo(start);
            while (dir is not null)
            {
                if (LooksLikeWorkspace(dir.FullName)) return dir.FullName;
                dir = dir.Parent;
            }
        }
        // Studio tool run outside a workspace: target the sibling framework
        // workspace in the same repo (a dir that holds both framework/ and studio/).
        foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            var dir = new DirectoryInfo(start);
            while (dir is not null)
            {
                var fwCode = Path.Combine(dir.FullName, "framework", "code");
                if (Directory.Exists(Path.Combine(dir.FullName, "studio")) && LooksLikeWorkspace(fwCode))
                    return fwCode;
                dir = dir.Parent;
            }
        }
        return "";
    }

    private static bool LooksLikeWorkspace(string dir) =>
        File.Exists(Path.Combine(dir, "governance", "budgets.json")) &&
        Directory.Exists(Path.Combine(dir, "framework"));

    /* ------------------------------------------------------------------ *
     *  Filesystem + text helpers (deterministic: everything is sorted)
     * ------------------------------------------------------------------ */

    private static List<string> Walk(string dir)
    {
        var outList = new List<string>();
        WalkInto(dir, outList);
        outList.Sort(StringComparer.Ordinal); // determinism: stable order regardless of FS
        return outList;
    }

    private static void WalkInto(string dir, List<string> outList)
    {
        if (!Directory.Exists(dir)) return;
        foreach (var entry in Directory.EnumerateFileSystemEntries(dir))
        {
            var name = Path.GetFileName(entry);
            if (Directory.Exists(entry))
            {
                if (SkipDirs.Contains(name)) continue;
                WalkInto(entry, outList);
            }
            else outList.Add(entry);
        }
    }

    private static List<string> WalkDirs(string dir)
    {
        var outList = new List<string>();
        WalkDirsInto(dir, outList);
        outList.Sort(StringComparer.Ordinal);
        return outList;
    }

    private static void WalkDirsInto(string dir, List<string> outList)
    {
        if (!Directory.Exists(dir)) return;
        foreach (var sub in Directory.EnumerateDirectories(dir))
        {
            var name = Path.GetFileName(sub);
            if (SkipDirs.Contains(name)) continue;
            outList.Add(sub);
            WalkDirsInto(sub, outList);
        }
    }

    private static string Read(string file)
    {
        var text = File.ReadAllText(file, Encoding.UTF8);
        return text.Length > 0 && text[0] == '﻿' ? text.Substring(1) : text;
    }

    private static double Kb(string text) => Encoding.UTF8.GetByteCount(text) / 1024.0;

    private static double GzKb(string text)
    {
        var raw = Encoding.UTF8.GetBytes(text);
        using var ms = new MemoryStream();
        using (var gz = new GZipStream(ms, CompressionLevel.Optimal, leaveOpen: true))
            gz.Write(raw, 0, raw.Length);
        return ms.Length / 1024.0;
    }

    private static int Lines(string text) => Regex.Split(text, "\r?\n").Length;

    private static string Rel(string file) =>
        Path.GetRelativePath(_root, file).Replace('\\', '/');

    private static bool IsJs(string f) => f.EndsWith(".js", StringComparison.Ordinal) ||
                                          f.EndsWith(".mjs", StringComparison.Ordinal);

    /// <summary>
    /// Blank out // line comments and /* */ block comments, replacing their
    /// characters with spaces while preserving newlines and total length — so
    /// line numbers stay accurate and tokens inside comments never false-match.
    /// String literals are preserved (tokens in strings still count as usage).
    /// </summary>
    private static string BlankComments(string code)
    {
        var sb = new StringBuilder(code.Length);
        int i = 0, n = code.Length;
        while (i < n)
        {
            char c = code[i];
            // string literals — copy through untouched
            if (c is '"' or '\'' or '`')
            {
                char quote = c;
                sb.Append(c); i++;
                while (i < n)
                {
                    char d = code[i];
                    sb.Append(d);
                    if (d == '\\' && i + 1 < n) { sb.Append(code[i + 1]); i += 2; continue; }
                    i++;
                    if (d == quote) break;
                }
                continue;
            }
            if (c == '/' && i + 1 < n && code[i + 1] == '/')
            {
                while (i < n && code[i] != '\n') { sb.Append(' '); i++; }
                continue;
            }
            if (c == '/' && i + 1 < n && code[i + 1] == '*')
            {
                while (i < n && !(code[i] == '*' && i + 1 < n && code[i + 1] == '/'))
                { sb.Append(code[i] == '\n' ? '\n' : ' '); i++; }
                if (i < n) { sb.Append("  "); i += 2; } // the closing */
                continue;
            }
            sb.Append(c); i++;
        }
        return sb.ToString();
    }

    /* ------------------------------------------------------------------ *
     *  A6 — dependency surface manifest (finite, auditable)
     * ------------------------------------------------------------------ */

    private static void EmitSurface()
    {
        var exts = new HashSet<string>(StringComparer.Ordinal) { ".js", ".mjs", ".css", ".json", ".html" };
        int count = Walk(Path.Combine(_root, "framework"))
            .Count(f => exts.Contains(Path.GetExtension(f)));
        Report.Add($"Dependency surface (A6): {count} framework files the runtime can load.");
    }

    /* ------------------------------------------------------------------ *
     *  A1 — dependency purity: only relative-path ES module imports
     * ------------------------------------------------------------------ */

    private static readonly Regex[] ImportPatterns =
    {
        new(@"\bimport\b[^;'""]*?\bfrom\s*[""']([^""']+)[""']", RegexOptions.Compiled),
        new(@"\bexport\b[^;'""]*?\bfrom\s*[""']([^""']+)[""']", RegexOptions.Compiled),
        new(@"\bimport\s*[""']([^""']+)[""']", RegexOptions.Compiled),
    };
    private static readonly Regex DynImport = new(@"\bimport\s*\(\s*([^)]*?)\)", RegexOptions.Compiled);
    private static readonly Regex LeadingLiteral = new(@"^[""']([^""']+)[""']", RegexOptions.Compiled);

    private static bool IsRelative(string spec) =>
        spec.StartsWith("./", StringComparison.Ordinal) || spec.StartsWith("../", StringComparison.Ordinal);

    private static void CheckDependencyPurity()
    {
        var targets = Walk(Path.Combine(_root, "framework"))
            .Concat(Walk(Path.Combine(_root, "applications")))
            .Where(IsJs).Distinct().OrderBy(x => x, StringComparer.Ordinal);

        foreach (var file in targets)
        {
            var code = BlankComments(Read(file));
            foreach (var re in ImportPatterns)
                foreach (Match m in re.Matches(code))
                    if (!IsRelative(m.Groups[1].Value))
                        Fail("A1", Rel(file) + " imports non-relative specifier \"" + m.Groups[1].Value +
                            "\" (no npm, CDNs or bare specifiers).");

            foreach (Match d in DynImport.Matches(code))
            {
                var arg = d.Groups[1].Value.Trim();
                var lit = LeadingLiteral.Match(arg);
                if (!lit.Success)
                    Fail("A1", Rel(file) + " has a dynamic import() whose target is not a statically " +
                        "verifiable relative path: import(" + Trunc(arg, 48) + ").");
                else if (!IsRelative(lit.Groups[1].Value))
                    Fail("A1", Rel(file) + " dynamic import() begins with non-relative specifier \"" +
                        lit.Groups[1].Value + "\".");
            }
        }
    }

    private static string Trunc(string s, int n) => s.Length <= n ? s : s.Substring(0, n);

    /* ------------------------------------------------------------------ *
     *  A2 — no bundling / minification
     * ------------------------------------------------------------------ */

    private static void CheckNoBundling()
    {
        foreach (var file in Walk(Path.Combine(_root, "framework")).Where(IsJs))
        {
            var code = Read(file);
            if (Path.GetFileName(file).EndsWith(".min.js", StringComparison.Ordinal))
                Fail("A2", Rel(file) + " is a minified bundle (.min.js).");
            if (code.Contains("sourceMappingURL", StringComparison.Ordinal))
                Fail("A2", Rel(file) + " references a source map (built artifact).");
            int longest = 0;
            foreach (var l in Regex.Split(code, "\r?\n")) longest = Math.Max(longest, l.Length);
            if (longest > 1000)
                Fail("A2", Rel(file) + " has a " + longest + "-char line (looks minified).");
        }
    }

    /* ------------------------------------------------------------------ *
     *  A3 — Content Security Policy presence and strictness
     * ------------------------------------------------------------------ */

    private static readonly Regex CspMeta = new(
        @"http-equiv=[""']Content-Security-Policy[""'][^>]*?content=([""'])([\s\S]*?)\1",
        RegexOptions.IgnoreCase);

    private static void CheckCsp()
    {
        var indexFile = Path.Combine(_root, "index.html");
        if (!File.Exists(indexFile)) { Fail("A3", "index.html not found."); return; }
        var html = Read(indexFile);
        var m = CspMeta.Match(html);
        if (!m.Success) { Fail("A3", "index.html has no Content-Security-Policy meta tag."); return; }
        var csp = m.Groups[2].Value;

        foreach (var directive in new[]
        {
            "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:",
            "connect-src", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
            "frame-ancestors 'none'"
        })
            if (!csp.Contains(directive, StringComparison.Ordinal))
                Fail("A3", "CSP is missing required directive: " + directive + ".");

        foreach (var banned in new[] { "unsafe-inline", "unsafe-eval" })
            if (csp.Contains(banned, StringComparison.Ordinal))
                Fail("A3", "CSP contains forbidden '" + banned + "'.");

        if (Regex.IsMatch(csp, @"(^|\s)\*(\s|;|$)") || Regex.IsMatch(csp, @"-src[^;]*\*"))
            Fail("A3", "CSP contains a wildcard origin.");

        // connect-src must be exactly 'self' plus the datasource allow-list (spec §15.5).
        var policyFile = Path.Combine(_root, "governance", "policies", "datasources.policy.json");
        var allowed = ReadAllowedOrigins(policyFile);
        var cm = Regex.Match(csp, @"connect-src([^;]*)", RegexOptions.IgnoreCase);
        var tokens = cm.Success
            ? cm.Groups[1].Value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            : Array.Empty<string>();
        var permitted = new HashSet<string>(StringComparer.Ordinal) { "'self'" };
        foreach (var o in allowed) permitted.Add(o);

        foreach (var origin in allowed)
            if (!tokens.Contains(origin))
                Fail("A3", "CSP connect-src is missing allow-listed datasource origin '" + origin +
                    "'. Run: node tools/thirai-deploy.mjs csp");
        foreach (var tok in tokens)
            if (!permitted.Contains(tok))
                Fail("A3", "CSP connect-src lists '" + tok +
                    "', which is neither 'self' nor a datasource allow-list origin.");
    }

    private static List<string> ReadAllowedOrigins(string policyFile)
    {
        var doc = LoadJson(policyFile);
        var result = new List<string>();
        if (doc is { } d && d.TryGetProperty("allowedOrigins", out var arr) &&
            arr.ValueKind == JsonValueKind.Array)
            foreach (var e in arr.EnumerateArray())
                if (e.ValueKind == JsonValueKind.String) result.Add(e.GetString()!);
        return result;
    }

    /* ------------------------------------------------------------------ *
     *  A4 — datasource allow-list integrity (REST origins)
     * ------------------------------------------------------------------ */

    private static void CheckDatasourceAllowList()
    {
        var policyFile = Path.Combine(_root, "governance", "policies", "datasources.policy.json");
        if (!File.Exists(policyFile)) { Warn("A4", "datasources.policy.json not found; skipping."); return; }
        var allowed = ReadAllowedOrigins(policyFile);
        var appsDir = Path.Combine(_root, "applications");
        if (!Directory.Exists(appsDir)) return;

        foreach (var file in Walk(appsDir).Where(f => f.EndsWith(".datasource.json", StringComparison.Ordinal)))
        {
            var decl = LoadJson(file);
            if (decl is null) { Fail("A4", Rel(file) + " is not valid JSON."); continue; }
            if (!(decl.Value.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.String &&
                  t.GetString() == "rest")) continue;
            if (!(decl.Value.TryGetProperty("source", out var s) && s.ValueKind == JsonValueKind.String))
            { Fail("A4", Rel(file) + " has an invalid REST source URL."); continue; }
            if (!Uri.TryCreate(s.GetString(), UriKind.Absolute, out var uri))
            { Fail("A4", Rel(file) + " has an invalid REST source URL."); continue; }
            var origin = uri.GetLeftPart(UriPartial.Authority);
            if (!allowed.Contains(origin))
                Fail("A4", Rel(file) + " calls origin \"" + origin +
                    "\" which is not on the datasource allow-list.");
        }
    }

    /* ------------------------------------------------------------------ *
     *  C2 — no bare `throw new Error` in framework code
     * ------------------------------------------------------------------ */

    private static readonly Regex BuiltinThrow = new(
        @"throw\s+new\s+(Error|TypeError|RangeError|SyntaxError|EvalError|URIError|ReferenceError)\s*\(",
        RegexOptions.Compiled);

    private static void CheckNoBareThrow()
    {
        foreach (var file in Walk(Path.Combine(_root, "framework")).Where(IsJs))
        {
            var code = BlankComments(Read(file));
            var m = BuiltinThrow.Match(code);
            if (m.Success)
                Fail("C2", Rel(file) + " throws a bare " + m.Groups[1].Value +
                    "; use a ThiraiError via kernel.error(...).");
        }
    }

    /* ------------------------------------------------------------------ *
     *  Forbidden directories (components/hooks/stores/...)
     * ------------------------------------------------------------------ */

    private static void CheckForbiddenDirectories(JsonElement budgets)
    {
        var forbidden = new HashSet<string>(StringComparer.Ordinal);
        if (budgets.TryGetProperty("forbiddenDirectories", out var arr) && arr.ValueKind == JsonValueKind.Array)
            foreach (var e in arr.EnumerateArray())
                if (e.ValueKind == JsonValueKind.String) forbidden.Add(e.GetString()!);

        // Catch forbidden directories even when empty (directory-level scan).
        foreach (var dir in WalkDirs(_root))
            if (forbidden.Contains(Path.GetFileName(dir)))
                Fail("DIRS", "Forbidden directory present: " + Path.GetFileName(dir) + " (in " + Rel(dir) + ").");
    }

    /* ------------------------------------------------------------------ *
     *  Size budgets (spec §15.2)
     * ------------------------------------------------------------------ */

    private static void CheckBudgets(JsonElement b)
    {
        _sizeWarnTolerancePct = Num(b, "sizeBudgetWarnTolerancePercent") ?? 0;
        var frameworkDir = Path.Combine(_root, "framework");
        var jsFiles = Walk(frameworkDir).Where(IsJs).ToList();
        var cssFiles = Walk(frameworkDir).Where(f => f.EndsWith(".css", StringComparison.Ordinal)).ToList();

        double totalJs = 0, totalGz = 0, totalCss = 0;
        foreach (var f in jsFiles) { var c = Read(f); totalJs += Kb(c); totalGz += GzKb(c); }
        foreach (var f in cssFiles) totalCss += Kb(Read(f));

        BudgetCheck("framework JS (uncompressed)", totalJs, Num(b, "frameworkJsUncompressedKB"), "KB");
        BudgetCheck("framework JS (gzipped)", totalGz, Num(b, "frameworkJsGzippedKB"), "KB");
        BudgetCheck("framework CSS", totalCss, Num(b, "frameworkCssKB"), "KB");

        var kernelFile = Path.Combine(frameworkDir, "kernel", "thirai-kernel.js");
        if (File.Exists(kernelFile))
        {
            var c = Read(kernelFile);
            BudgetCheck("kernel lines", Lines(c), Num(b, "kernelLines"), "lines");
            BudgetCheck("kernel size", Kb(c), Num(b, "kernelKB"), "KB");
        }

        foreach (var f in Walk(Path.Combine(frameworkDir, "engines")).Where(IsJs))
        {
            var c = Read(f);
            BudgetCheck(Rel(f) + " lines", Lines(c), Num(b, "engineLines"), "lines");
            BudgetCheck(Rel(f) + " size", Kb(c), Num(b, "engineKB"), "KB");
        }

        var appsDir = Path.Combine(_root, "applications");
        if (Directory.Exists(appsDir))
            foreach (var f in Walk(appsDir).Where(x => x.EndsWith(".page.json", StringComparison.Ordinal)))
                BudgetCheck(Rel(f), Kb(Read(f)), Num(b, "pageMetadataKB"), "KB");
    }

    private static double? Num(JsonElement b, string prop) =>
        b.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;

    private static void BudgetCheck(string label, double value, double? limit, string unit)
    {
        if (limit is null) return;
        double v = unit == "KB" ? Math.Round(value * 100) / 100 : value;
        // Size budgets are graduated (spec §15.2): within budget passes; over budget but
        // within the tolerance band warns (a debt to pay down, not a new ceiling); beyond
        // the band hard-fails. The security/purity/CSP/allow-list/privacy checks elsewhere
        // are never graduated — they hard-fail on any violation.
        double hardLimit = Math.Round(limit.Value * (1 + _sizeWarnTolerancePct / 100.0) * 100) / 100;
        string status = value <= limit.Value ? "pass" : value <= hardLimit ? "warn" : "fail";
        Budgets.Add(new BudgetLine(label, v, limit.Value, unit, status));
        if (status == "fail")
            Fail("BUDGET", label + " = " + Fmt(v) + " " + unit + " exceeds limit " + Fmt(limit.Value) + " " + unit +
                " by more than the " + Fmt(_sizeWarnTolerancePct) + "% tolerance (hard limit " + Fmt(hardLimit) + " " + unit + ").");
        else if (status == "warn")
            Warn("BUDGET", label + " = " + Fmt(v) + " " + unit + " exceeds limit " + Fmt(limit.Value) + " " + unit +
                " but is within the " + Fmt(_sizeWarnTolerancePct) + "% tolerance — bring it back under " + Fmt(limit.Value) + " " + unit + " before it hard-fails.");
        else
            Report.Add("  " + label + " = " + Fmt(v) + " " + unit + " (limit " + Fmt(limit.Value) + ")");
    }

    private static string Fmt(double d) =>
        d == Math.Floor(d) ? ((long)d).ToString(CultureInfo.InvariantCulture)
                           : d.ToString("0.##", CultureInfo.InvariantCulture);

    /* ------------------------------------------------------------------ *
     *  Privacy-guardian checks (governed data: governance/privacy.policy.json)
     * ------------------------------------------------------------------ */

    private static void RunPrivacyChecks()
    {
        var policyFile = Path.Combine(_root, "governance", "privacy.policy.json");
        var policy = LoadJson(policyFile);
        if (policy is null)
        {
            Warn("PRIVACY", "governance/privacy.policy.json not found; privacy-guardian checks skipped. " +
                "Add it so privacy is enforced by governed configuration (Directive 5).");
            return;
        }
        if (!policy.Value.TryGetProperty("checks", out var checks) || checks.ValueKind != JsonValueKind.Object)
        { Warn("PRIVACY", "privacy.policy.json has no 'checks' object."); return; }

        var frameworkDir = Path.Combine(_root, "framework");
        var indexFile = Path.Combine(_root, "index.html");

        foreach (var check in checks.EnumerateObject())
        {
            var def = check.Value;
            string id = Str(def, "id") ?? check.Name;

            var tokens = StrArray(def, "forbiddenTokens");
            var banned = StrArray(def, "bannedApis");
            var literalApis = StrArray(def, "literalTargetApis");
            var extPrefixes = StrArray(def, "externalUrlPrefixes");
            var trackers = StrArray(def, "trackerTokens");
            var attrs = StrArray(def, "attributes");
            var cssPatterns = StrArray(def, "cssRemotePatterns");
            var fileTypes = StrArray(def, "fileTypes");
            var appliesTo = StrArray(def, "appliesTo");

            bool scanFramework = appliesTo.Count == 0 || appliesTo.Contains("framework");
            bool scanIndex = appliesTo.Contains("indexHtml");

            // Which framework files does this check inspect?
            var frameworkTargets = scanFramework
                ? Walk(frameworkDir).Where(f => fileTypes.Count == 0 ||
                      fileTypes.Contains(Path.GetExtension(f))).ToList()
                : new List<string>();

            // --- forbiddenTokens (substring usage, comment-blanked for .js)
            foreach (var file in frameworkTargets)
            {
                var raw = Read(file);
                var code = IsJs(file) ? BlankComments(raw) : raw;
                foreach (var tok in tokens)
                {
                    int line = FindLine(code, tok);
                    if (line > 0)
                        Fail(id, Rel(file) + ":" + line + " uses '" + tok + "' — " +
                            (Str(def, "title") ?? "privacy rule violated") +
                            (Str(def, "remedy") is { } r ? " Remedy: " + r : ""));
                }
            }

            // --- bannedApis (no legitimate use in framework core; any occurrence fails)
            foreach (var file in frameworkTargets.Where(IsJs))
            {
                var code = BlankComments(Read(file));
                foreach (var api in banned)
                {
                    int line = FindLine(code, api);
                    if (line > 0)
                        Fail(id, Rel(file) + ":" + line + " references '" + api +
                            "' — framework core must make zero external calls." +
                            (Str(def, "remedy") is { } r ? " Remedy: " + r : ""));
                }
            }

            // --- literalTargetApis (e.g. fetch): flag only external string-literal targets
            foreach (var file in frameworkTargets.Where(IsJs))
            {
                var code = BlankComments(Read(file));
                foreach (var api in literalApis)
                {
                    var re = new Regex(Regex.Escape(api) + @"\s*\(\s*[""'`]([^""'`]+)[""'`]");
                    foreach (Match mm in re.Matches(code))
                    {
                        var target = mm.Groups[1].Value;
                        if (extPrefixes.Any(p => target.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
                            Fail(id, Rel(file) + ":" + LineAt(code, mm.Index) + " calls " + api +
                                "() against an external origin \"" + Trunc(target, 60) +
                                "\" — framework core must make zero external calls." +
                                (Str(def, "remedy") is { } r ? " Remedy: " + r : ""));
                    }
                }
            }

            // --- markup/asset scan (index.html + framework .html/.css)
            var markupTargets = new List<string>();
            if (scanIndex && File.Exists(indexFile)) markupTargets.Add(indexFile);
            if (scanFramework)
                markupTargets.AddRange(Walk(frameworkDir).Where(f =>
                    fileTypes.Contains(Path.GetExtension(f))));
            markupTargets = markupTargets.Distinct().OrderBy(x => x, StringComparer.Ordinal).ToList();

            foreach (var file in markupTargets)
            {
                var ext = Path.GetExtension(file);
                if (ext is not (".html" or ".css")) continue;
                var text = Read(file);

                // remote src=/href= attributes (HTML)
                if (ext == ".html" && attrs.Count > 0 && extPrefixes.Count > 0)
                {
                    var attrRe = new Regex(@"\b(" + string.Join("|", attrs.Select(Regex.Escape)) +
                        @")\s*=\s*[""']([^""']*)[""']", RegexOptions.IgnoreCase);
                    foreach (Match am in attrRe.Matches(text))
                    {
                        var val = am.Groups[2].Value.Trim();
                        if (extPrefixes.Any(p => val.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
                            Fail(id, Rel(file) + ":" + LineAt(text, am.Index) + " has a remote " +
                                am.Groups[1].Value + "=\"" + Trunc(val, 60) +
                                "\" — no third-party/CDN references allowed." +
                                (Str(def, "remedy") is { } r ? " Remedy: " + r : ""));
                    }
                }

                // remote CSS url()/@import
                if (ext == ".css")
                    foreach (var pat in cssPatterns)
                    {
                        int line = FindLine(text, pat);
                        if (line > 0)
                            Fail(id, Rel(file) + ":" + line + " loads a remote asset ('" + pat +
                                "') — no third-party/CDN references allowed." +
                                (Str(def, "remedy") is { } r ? " Remedy: " + r : ""));
                    }

                // known tracker tokens anywhere
                foreach (var tok in trackers)
                {
                    int line = FindLine(text, tok);
                    if (line > 0)
                        Fail(id, Rel(file) + ":" + line + " contains tracker/analytics reference '" + tok +
                            "' — no third-party tracking allowed." +
                            (Str(def, "remedy") is { } r ? " Remedy: " + r : ""));
                }
            }
        }
    }

    /// <summary>1-based line of the first occurrence of <paramref name="needle"/>, or 0 if absent.</summary>
    private static int FindLine(string haystack, string needle)
    {
        int idx = haystack.IndexOf(needle, StringComparison.Ordinal);
        return idx < 0 ? 0 : LineAt(haystack, idx);
    }

    private static int LineAt(string text, int index)
    {
        int line = 1;
        for (int i = 0; i < index && i < text.Length; i++)
            if (text[i] == '\n') line++;
        return line;
    }

    /* ------------------------------------------------------------------ *
     *  Report (only if --report <path>) — minimal, no source, no machine info
     * ------------------------------------------------------------------ */

    private static void WriteReport(string path)
    {
        using var stream = new MemoryStream();
        var opts = new JsonWriterOptions
        {
            Indented = true,
            // Relaxed escaping keeps the report human-readable and hashable; it is
            // still deterministic and contains no source or machine info.
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };
        using (var w = new Utf8JsonWriter(stream, opts))
        {
            w.WriteStartObject();
            w.WriteString("tool", "thirai-verify");
            w.WriteString("result", Failures.Count == 0 ? "pass" : "fail");
            w.WriteNumber("violations", Failures.Count);

            w.WriteStartArray("checks");
            foreach (var f in Failures)
            {
                int c = f.IndexOf(':');
                w.WriteStartObject();
                w.WriteString("check", c > 0 ? f.Substring(0, c) : f);
                w.WriteString("status", "fail");
                w.WriteString("detail", c > 0 ? f.Substring(c + 1).Trim() : "");
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("budgets");
            foreach (var b in Budgets)
            {
                w.WriteStartObject();
                w.WriteString("check", b.Label);
                w.WriteNumber("value", b.Value);
                w.WriteNumber("limit", b.Limit);
                w.WriteString("unit", b.Unit);
                w.WriteString("status", b.Status);
                w.WriteEndObject();
            }
            w.WriteEndArray();
            w.WriteEndObject();
        }
        // Deterministic newline; single explicit write, nothing else touched.
        File.WriteAllText(path, Encoding.UTF8.GetString(stream.ToArray()) + "\n", new UTF8Encoding(false));
        Console.WriteLine("\nReport written: " + path);
    }

    /* ------------------------------------------------------------------ *
     *  JSON helpers
     * ------------------------------------------------------------------ */

    private static JsonElement? LoadJson(string file)
    {
        if (!File.Exists(file)) return null;
        try
        {
            var text = Read(file);
            using var doc = JsonDocument.Parse(text);
            return doc.RootElement.Clone();
        }
        catch { return null; }
    }

    private static string? Str(JsonElement e, string prop) =>
        e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static List<string> StrArray(JsonElement e, string prop)
    {
        var list = new List<string>();
        if (e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Array)
            foreach (var i in v.EnumerateArray())
                if (i.ValueKind == JsonValueKind.String) list.Add(i.GetString()!);
        return list;
    }

    private readonly record struct BudgetLine(string Label, double Value, double Limit, string Unit, string Status);
}
