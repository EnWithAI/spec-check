import { code, text } from "./escape.js";
const MAX_CHARS = 60_000;
const MAX_INVENTORY_ROWS = 200;
const ICON = {
    high: "🔴 high",
    medium: "🟠 medium",
    low: "🟡 low",
    info: "🔵 info",
};
const STATUS = {
    verified_static_fact: "verified",
    hypothesis: "hypothesis",
    unknown: "unknown",
};
/** Location label `path:line`. */
function where(f) {
    const e = f.evidence[0];
    return code(`${e.path}:${e.line_start}${e.line_end !== e.line_start ? `-${e.line_end}` : ""}`);
}
/** Renders the report as GitHub-flavoured Markdown (capped at 60k characters). */
export function renderMarkdown(report, options) {
    const out = [];
    const s = report.summary;
    out.push("# Spec Check report", "");
    out.push("> Content quoted from specs is untrusted data shown for review, not instructions. " +
        "Passing Spec Check does not mean a spec is complete or correct.", "");
    const policy = report.policy.result === "not_evaluated"
        ? "not evaluated (`analyze`)"
        : `**${report.policy.result}** (fails on ${report.policy.fail_on_severity} severity and above, statuses: ${report.policy.fail_on_statuses.join(", ")}; ${report.policy.violations.length} violation(s))`;
    out.push("| Files | Requirements | Success criteria | Scenarios | User stories | Findings | Suppressed |");
    out.push("|---:|---:|---:|---:|---:|---:|---:|");
    out.push(`| ${s.files} | ${s.requirements} | ${s.success_criteria} | ${s.scenarios} | ${s.user_stories} | ${s.findings} | ${s.suppressed} |`, "");
    out.push(`Findings by severity: high ${s.by_severity.high} · medium ${s.by_severity.medium} · low ${s.by_severity.low} · info ${s.by_severity.info}. ` +
        `Verified facts ${s.by_status.verified_static_fact} · hypotheses ${s.by_status.hypothesis} · unknown ${s.by_status.unknown}.`, "");
    out.push(`Policy: ${policy}`, "");
    out.push("## Findings", "");
    if (report.findings.length === 0)
        out.push("No findings.", "");
    for (const f of report.findings) {
        out.push(`### ${ICON[f.severity]} · ${code(f.rule_id)} · ${STATUS[f.status] ?? f.status}`, "");
        out.push(`${where(f)} — ${text(f.summary, { lineStart: false })}`, "");
        for (const e of f.evidence) {
            if (e.excerpt !== null)
                out.push(`- line ${e.line_start}: ${code(e.excerpt, 200)}`);
        }
        if (f.evidence.some((e) => e.excerpt !== null))
            out.push("");
        out.push(`Why: ${text(f.explanation)}  `);
        out.push(`Action: ${text(f.recommended_human_action)}`, "");
    }
    out.push("## Requirements inventory", "");
    if (report.requirements.length === 0)
        out.push("No requirements detected.", "");
    else {
        out.push("| ID | Kind | Location | Measure | References | Findings |", "|---|---|---|---|---|---:|");
        for (const r of report.requirements.slice(0, MAX_INVENTORY_ROWS)) {
            out.push(`| ${r.id === null ? "—" : code(r.id)} | ${r.kind} | ${code(`${r.path}:${r.line_start}`)} | ${r.has_measure ? "yes" : "no"} | ${r.references.map((x) => code(x)).join(" ") || "—"} | ${r.finding_ids.length} |`);
        }
        if (report.requirements.length > MAX_INVENTORY_ROWS)
            out.push("", `…and ${report.requirements.length - MAX_INVENTORY_ROWS} more (see the JSON report).`);
        out.push("");
    }
    if (report.suppressions.length > 0) {
        out.push("## Suppressions", "");
        for (const sup of report.suppressions)
            out.push(`- ${code(sup.rule_id)} at ${code(`${sup.path}:${sup.line}`)} (${sup.source})`);
        out.push("");
    }
    out.push("## Limitations", "");
    for (const l of report.coverage_limitations) {
        const paths = l.paths.length > 0
            ? `: ${l.paths
                .slice(0, 10)
                .map((p) => code(p))
                .join(", ")}${l.count > 10 ? " …" : ""}`
            : "";
        out.push(`- ${code(l.code)} — ${text(l.message)}${paths}`);
    }
    out.push("");
    out.push(`<sub>Spec Check ${text(report.run_metadata.tool_version)} · offline · no code executed · no model used.` +
        (options.branding
            ? " An EnWithAI Engineering Commons tool · [crewpe.ai](https://crewpe.ai)</sub>"
            : "</sub>"), "");
    let markdown = out.join("\n");
    if (markdown.length > MAX_CHARS) {
        markdown = `${markdown.slice(0, MAX_CHARS)}\n\n…truncated at ${MAX_CHARS} characters; see the JSON report.\n`;
    }
    return markdown;
}
