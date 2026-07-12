/*
 * Thirai Packager (spec §8) — builds a self-contained, privacy-scrubbed .tpk for
 * one application, and verifies one. Native C# / .NET 10, BCL only, ZERO
 * third-party dependencies. Uses only System.IO.Compression (zip) and
 * System.Security.Cryptography (SHA-256). Ships ZERO bytes to the browser.
 *
 * There is no rebuild and no recompilation, ever: the bytes copied into the
 * package are the bytes that run (spec §8.2).
 *
 * Privacy-first behaviour (the priority):
 *   - Exclusion scrub: .git/ logs/ node_modules/, .env & secret files, editor
 *     temp/backup (*~ *.bak *.swp *.tmp), OS cruft (.DS_Store, Thumbs.db) are
 *     never packaged. Only the declared application folder is read.
 *   - Relative paths only: every zip entry name is workspace/app-relative — no
 *     absolute path ever enters the package.
 *   - Deterministic / reproducible: fixed entry ordering + normalized (fixed)
 *     zip timestamps + a normalized descriptor `created` field, so the same
 *     input yields a byte-identical .tpk (verifiable by hash). The build time
 *     and build machine never leak through zip metadata.
 *   - Gate integration: runs thirai-verify first and ABORTS on non-zero exit —
 *     an application that fails the hardening/privacy gate cannot be packaged.
 *   - Zero network: there is no HTTP client anywhere in this program.
 *
 * Usage:
 *   thirai-package <applicationId> [workspaceRoot] [--verifier <path>]
 *   thirai-package --verify <file.tpk>
 * Exit: 0 = ok · 1 = refused / integrity failure · 2 = usage
 */

using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Thirai.Package;

internal static class Program
{
    // Normalized epoch for reproducibility (à la SOURCE_DATE_EPOCH). It is
    // intentionally NOT the real build time: a fixed timestamp keeps the .tpk
    // byte-identical and stops build-time/machine metadata leaking. 1980-01-01
    // is the ZIP format's minimum representable date.
    private static readonly DateTimeOffset Epoch = new(1980, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static readonly HashSet<string> ExcludedDirNames =
        new(StringComparer.OrdinalIgnoreCase) { ".git", "logs", "node_modules" };
    private static readonly HashSet<string> ExcludedFileNames =
        new(StringComparer.OrdinalIgnoreCase) { ".DS_Store", "Thumbs.db" };

    private static int Main(string[] args)
    {
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

        if (args.Length >= 1 && args[0] == "--verify")
        {
            if (args.Length < 2) { Console.Error.WriteLine("Usage: thirai-package --verify <file.tpk>"); return 2; }
            return VerifyPackage(Path.GetFullPath(args[1]));
        }

        // parse: <applicationId> [workspaceRoot] [--verifier <path>]
        string? appId = null, rootArg = null, verifierArg = null;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--verifier")
            {
                if (i + 1 >= args.Length) { Console.Error.WriteLine("--verifier requires a path."); return 2; }
                verifierArg = args[++i];
            }
            else if (appId is null) appId = args[i];
            else if (rootArg is null) rootArg = args[i];
            else { Console.Error.WriteLine("Unexpected argument: " + args[i]); return 2; }
        }

        if (appId is null)
        {
            Console.Error.WriteLine("Usage: thirai-package <applicationId> [workspaceRoot] [--verifier <path>]");
            Console.Error.WriteLine("       thirai-package --verify <file.tpk>");
            return 2;
        }

        var root = ResolveWorkspaceRoot(rootArg);
        if (root is "") { Console.Error.WriteLine("Could not locate a Thirai workspace. Pass the workspace root."); return 2; }

        return BuildPackage(root, appId, verifierArg);
    }

    /* ------------------------------------------------------------------ *
     *  Build
     * ------------------------------------------------------------------ */

    private static int BuildPackage(string root, string appId, string? verifierArg)
    {
        var appDir = Path.Combine(root, "applications", appId);
        if (!File.Exists(Path.Combine(appDir, "manifest.json")))
        {
            Console.Error.WriteLine($"No application '{appId}' at applications/{appId} (manifest.json missing).");
            return 2;
        }

        // 1. Verifier gate — refuse to package an unverifiable workspace (spec §15.4).
        Console.WriteLine("Running the Thirai Verifier before packaging…");
        int gate = RunVerifier(root, verifierArg);
        if (gate != 0)
        {
            Console.Error.WriteLine("\nPackaging refused: the verifier reported violations (spec §15.4).");
            return 1;
        }

        // 1b. Self-containment (spec §8.2): every file the app's indexes reference
        //     must be present, or packaging is refused — no dangling references.
        if (!CheckSelfContained(appDir, out var containErr))
        {
            Console.Error.WriteLine("\nPackaging refused (not self-contained, spec §8.2): " + containErr);
            return 1;
        }

        // 2. Collect the application's files (relative to the app folder), scrubbed.
        var files = CollectFiles(appDir); // sorted, workspace-relative, privacy-scrubbed
        if (files.Count == 0) { Console.Error.WriteLine("Nothing to package after the privacy scrub."); return 1; }

        // 3. Per-file SHA-256 checksums (spec §8.1, §15.1 A6), keys sorted.
        var checksums = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var (abs, rel) in files) checksums[rel] = Sha256Hex(File.ReadAllBytes(abs));

        // 4. Package descriptor (spec §8.1) — not npm's package.json. `created` is
        //    normalized (see Epoch) so the package is byte-reproducible.
        var manifest = LoadJson(Path.Combine(appDir, "manifest.json"))
            ?? throw new InvalidOperationException("manifest.json is not valid JSON.");
        string id = Str(manifest, "id") ?? appId;
        string version = Str(manifest, "version") ?? "0.0.0";
        string minVersion = "1.0.0";
        if (manifest.TryGetProperty("framework", out var fw) &&
            fw.ValueKind == JsonValueKind.Object && Str(fw, "minVersion") is { } mv) minVersion = mv;

        var descriptor = new StringBuilder();
        descriptor.Append("{\n");
        descriptor.Append($"  \"package\": {JsonStr(id)},\n");
        descriptor.Append($"  \"version\": {JsonStr(version)},\n");
        descriptor.Append($"  \"created\": {JsonStr(Epoch.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture))},\n");
        descriptor.Append($"  \"framework\": {{ \"minVersion\": {JsonStr(minVersion)} }},\n");
        descriptor.Append($"  \"files\": {files.Count + 2},\n");
        descriptor.Append("  \"signature\": \"optional-enterprise-signing-block\"\n");
        descriptor.Append("}\n");
        var descriptorBytes = Encoding.UTF8.GetBytes(descriptor.ToString());

        var checksumsBytes = Encoding.UTF8.GetBytes(SerializeChecksums(checksums));

        // 5. Assemble entries (fixed order) and write the .tpk deterministically.
        var packagesDir = Path.Combine(root, "packages");
        Directory.CreateDirectory(packagesDir); // the one dir we're allowed to make
        var outFile = Path.Combine(packagesDir, $"{id}-{version}.tpk");

        using (var ms = new MemoryStream())
        {
            using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
            {
                foreach (var (abs, rel) in files)               // app files, sorted
                    AddEntry(zip, rel, File.ReadAllBytes(abs));
                AddEntry(zip, "package.json", descriptorBytes); // then descriptor
                AddEntry(zip, "checksums.json", checksumsBytes); // then checksums
            }
            File.WriteAllBytes(outFile, ms.ToArray());          // single explicit write
        }

        var size = new FileInfo(outFile).Length / 1024.0;
        Console.WriteLine("\n✓ Built packages/" + Path.GetFileName(outFile));
        Console.WriteLine($"  package {id} v{version} · {files.Count + 2} files · {size.ToString("0.0", CultureInfo.InvariantCulture)} KB");
        Console.WriteLine("  deterministic: fixed entry order + normalized timestamps → byte-identical .tpk (verify by hash).");
        return 0;
    }

    private static void AddEntry(ZipArchive zip, string name, byte[] data)
    {
        // Forward-slash entry names (zip convention) — never an absolute path.
        var entry = zip.CreateEntry(name.Replace('\\', '/'), CompressionLevel.Optimal);
        entry.LastWriteTime = Epoch; // normalized: no build-time metadata leaks
        using var s = entry.Open();
        s.Write(data, 0, data.Length);
    }

    /* ------------------------------------------------------------------ *
     *  Privacy scrub — decide what is packaged
     * ------------------------------------------------------------------ */

    private static List<(string abs, string rel)> CollectFiles(string appDir)
    {
        var outList = new List<(string, string)>();
        CollectInto(appDir, appDir, outList);
        outList.Sort((a, b) => string.CompareOrdinal(a.Item2, b.Item2));
        return outList;
    }

    private static void CollectInto(string appDir, string dir, List<(string, string)> outList)
    {
        foreach (var entry in Directory.EnumerateFileSystemEntries(dir))
        {
            var name = Path.GetFileName(entry);
            if (Directory.Exists(entry))
            {
                if (ExcludedDirNames.Contains(name)) continue;
                CollectInto(appDir, entry, outList);
            }
            else if (!IsScrubbed(name))
            {
                var rel = Path.GetRelativePath(appDir, entry).Replace('\\', '/');
                outList.Add((entry, rel));
            }
            else Console.WriteLine("  scrubbed (excluded from package): " +
                Path.GetRelativePath(appDir, entry).Replace('\\', '/'));
        }
    }

    /// <summary>True if the file must never enter a package (privacy scrub).</summary>
    private static bool IsScrubbed(string name)
    {
        if (ExcludedFileNames.Contains(name)) return true;
        if (name.StartsWith(".env", StringComparison.OrdinalIgnoreCase)) return true;
        if (name.EndsWith("~", StringComparison.Ordinal)) return true;
        foreach (var ext in new[] { ".bak", ".swp", ".swo", ".tmp", ".log", ".pem", ".key", ".secret" })
            if (name.EndsWith(ext, StringComparison.OrdinalIgnoreCase)) return true;
        if (name.Contains("secret", StringComparison.OrdinalIgnoreCase) &&
            name.EndsWith(".json", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    /* ------------------------------------------------------------------ *
     *  Self-containment (spec §8.2)
     * ------------------------------------------------------------------ */

    private static bool CheckSelfContained(string appDir, out string error)
    {
        error = "";
        var pages = LoadJson(Path.Combine(appDir, "pages", "pages.json"));
        if (pages is { ValueKind: JsonValueKind.Array } pArr)
            foreach (var e in pArr.EnumerateArray())
                if (e.ValueKind == JsonValueKind.Object && Str(e, "file") is { } f &&
                    !File.Exists(Path.Combine(appDir, "pages", f)))
                { error = $"page file pages/{f} is referenced but missing."; return false; }

        var ds = LoadJson(Path.Combine(appDir, "datasources", "datasources.json"));
        if (ds is { ValueKind: JsonValueKind.Array } dArr)
            foreach (var e in dArr.EnumerateArray())
                if (e.ValueKind == JsonValueKind.String && e.GetString() is { } f &&
                    !File.Exists(Path.Combine(appDir, "datasources", f)))
                { error = $"datasource declaration datasources/{f} is referenced but missing."; return false; }

        var tpl = LoadJson(Path.Combine(appDir, "templates", "templates.json"));
        if (tpl is { ValueKind: JsonValueKind.Array } tArr)
            foreach (var e in tArr.EnumerateArray())
                if (e.ValueKind == JsonValueKind.String && e.GetString() is { } folder)
                    foreach (var need in new[] { "template.json", "template.html" })
                        if (!File.Exists(Path.Combine(appDir, "templates", folder, need)))
                        { error = $"template templates/{folder}/{need} is referenced but missing."; return false; }

        return true;
    }

    /* ------------------------------------------------------------------ *
     *  --verify: recompute checksums without extracting (spec §8.2)
     * ------------------------------------------------------------------ */

    private static int VerifyPackage(string tpkPath)
    {
        if (!File.Exists(tpkPath)) { Console.Error.WriteLine("Package not found: " + tpkPath); return 2; }
        Console.WriteLine("Verifying " + Path.GetFileName(tpkPath) + " (integrity, no extraction)…");

        using var zip = ZipFile.OpenRead(tpkPath);
        var checksumsEntry = zip.GetEntry("checksums.json");
        if (checksumsEntry is null) { Console.Error.WriteLine("x Package has no checksums.json."); return 1; }
        JsonElement recorded;
        using (var cs = checksumsEntry.Open())
        using (var doc = JsonDocument.Parse(cs)) recorded = doc.RootElement.Clone();

        var recordedNames = new HashSet<string>(StringComparer.Ordinal);
        int failures = 0, checked_ = 0;
        foreach (var prop in recorded.EnumerateObject()) recordedNames.Add(prop.Name);

        foreach (var entry in zip.Entries.OrderBy(e => e.FullName, StringComparer.Ordinal))
        {
            if (entry.FullName is "package.json" or "checksums.json") continue;
            if (entry.FullName.EndsWith("/", StringComparison.Ordinal)) continue;
            if (!recorded.TryGetProperty(entry.FullName, out var want) || want.ValueKind != JsonValueKind.String)
            { Console.WriteLine($"  x {entry.FullName}: no checksum recorded."); failures++; continue; }

            string got;
            using (var es = entry.Open()) got = Sha256Hex(ReadAll(es));
            recordedNames.Remove(entry.FullName);
            checked_++;
            if (!string.Equals(got, want.GetString(), StringComparison.Ordinal))
            { Console.WriteLine($"  x {entry.FullName}: checksum MISMATCH (corrupt or tampered)."); failures++; }
        }

        foreach (var missing in recordedNames.OrderBy(x => x, StringComparer.Ordinal))
        { Console.WriteLine($"  x {missing}: checksummed file is missing from the package."); failures++; }

        if (failures == 0)
        {
            Console.WriteLine($"\n✓ Integrity verified: {checked_} files match their SHA-256 checksums.");
            return 0;
        }
        Console.Error.WriteLine($"\nx Integrity FAILED: {failures} problem(s).");
        return 1;
    }

    /* ------------------------------------------------------------------ *
     *  Verifier gate invocation
     * ------------------------------------------------------------------ */

    private static int RunVerifier(string root, string? verifierArg)
    {
        var exe = ResolveVerifier(verifierArg);
        var psi = new System.Diagnostics.ProcessStartInfo { UseShellExecute = false };
        if (exe is not null)
        {
            psi.FileName = exe;
            psi.ArgumentList.Add(root);
        }
        else
        {
            // Dev fallback: run the sibling ThiraiVerify project via the SDK.
            var project = ResolveVerifierProject();
            if (project is null)
            {
                Console.Error.WriteLine("Could not locate the ThiraiVerify project. " +
                    "Pass --verifier <path-to-thirai-verify(.exe)>.");
                return 1;
            }
            psi.FileName = "dotnet";
            psi.ArgumentList.Add("run");
            psi.ArgumentList.Add("--project");
            psi.ArgumentList.Add(project);
            psi.ArgumentList.Add("-c");
            psi.ArgumentList.Add("Release");
            psi.ArgumentList.Add("--");
            psi.ArgumentList.Add(root);
        }
        try
        {
            using var p = System.Diagnostics.Process.Start(psi)!;
            p.WaitForExit();
            return p.ExitCode;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Could not run the verifier (" + ex.Message +
                "). Pass --verifier <path-to-thirai-verify(.exe)>.");
            return 1;
        }
    }

    private static string? ResolveVerifier(string? verifierArg)
    {
        if (verifierArg is not null) return Path.GetFullPath(verifierArg);
        // sibling to this executable (intended tools-bin deployment)
        foreach (var candidate in new[] { "thirai-verify.exe", "thirai-verify" })
        {
            var p = Path.Combine(AppContext.BaseDirectory, candidate);
            if (File.Exists(p)) return p;
        }
        return null; // -> dev fallback (dotnet run against the sibling project)
    }

    /// <summary>Find the sibling ThiraiVerify project (Studio tools live side by side).</summary>
    private static string? ResolveVerifierProject()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var proj = Path.Combine(dir.FullName, "ThiraiVerify", "ThiraiVerify.csproj");
            if (File.Exists(proj)) return Path.GetDirectoryName(proj);
            dir = dir.Parent;
        }
        return null;
    }

    /* ------------------------------------------------------------------ *
     *  Helpers
     * ------------------------------------------------------------------ */

    private static string ResolveWorkspaceRoot(string? arg)
    {
        if (arg is not null) return Path.GetFullPath(arg);
        foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            var dir = new DirectoryInfo(start);
            while (dir is not null)
            {
                if (Directory.Exists(Path.Combine(dir.FullName, "applications")) &&
                    Directory.Exists(Path.Combine(dir.FullName, "framework")))
                    return dir.FullName;
                dir = dir.Parent;
            }
        }
        // Studio tool run outside a workspace: target the sibling framework/code.
        foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            var dir = new DirectoryInfo(start);
            while (dir is not null)
            {
                var fwCode = Path.Combine(dir.FullName, "framework", "code");
                if (Directory.Exists(Path.Combine(dir.FullName, "studio")) &&
                    Directory.Exists(Path.Combine(fwCode, "applications")) &&
                    Directory.Exists(Path.Combine(fwCode, "framework")))
                    return fwCode;
                dir = dir.Parent;
            }
        }
        return "";
    }

    private static string Sha256Hex(byte[] data) => Convert.ToHexString(SHA256.HashData(data)).ToLowerInvariant();

    private static byte[] ReadAll(Stream s)
    {
        using var ms = new MemoryStream();
        s.CopyTo(ms);
        return ms.ToArray();
    }

    private static string SerializeChecksums(SortedDictionary<string, string> map)
    {
        var sb = new StringBuilder();
        sb.Append("{\n");
        int i = 0, n = map.Count;
        foreach (var kv in map)
            sb.Append($"  {JsonStr(kv.Key)}: {JsonStr(kv.Value)}{(++i < n ? "," : "")}\n");
        sb.Append("}\n");
        return sb.ToString();
    }

    private static string JsonStr(string s)
    {
        var sb = new StringBuilder(s.Length + 2);
        sb.Append('"');
        foreach (var c in s)
            sb.Append(c switch
            {
                '"' => "\\\"",
                '\\' => "\\\\",
                '\n' => "\\n",
                '\r' => "\\r",
                '\t' => "\\t",
                _ => c.ToString()
            });
        sb.Append('"');
        return sb.ToString();
    }

    private static JsonElement? LoadJson(string file)
    {
        if (!File.Exists(file)) return null;
        try
        {
            var text = File.ReadAllText(file, Encoding.UTF8);
            if (text.Length > 0 && text[0] == '﻿') text = text.Substring(1);
            using var doc = JsonDocument.Parse(text);
            return doc.RootElement.Clone();
        }
        catch { return null; }
    }

    private static string? Str(JsonElement e, string prop) =>
        e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
}
