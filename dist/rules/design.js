// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Design-package profile rules (docs/SPEC.md §5a): ADR structure, status and supersede links; service-level targets;
 * security and AI-governance headings per design package; required documents. Only presence is checked, never whether
 * the content is adequate. Pure apart from the file list passed in by the analyzer.
 */
import { posix } from "node:path";
import { matchesAny, requiredDocuments } from "../config.js";
import { stripCodeSpans, stripEmphasis } from "../parse/markdown.js";
import { AI_VOCABULARY, hasNumber, INDICATOR, PERCENT_OR_PERCENTILE, SERVICE_LEVEL, WINDOW, } from "./lexicon.js";
/** True when the path matches the ADR globs and the file name starts with a number. */
export function isAdr(path, config) {
    return matchesAny(path, config.designPackage.adrPaths) && /^\d{1,5}[-_]/.test(posix.basename(path));
}
/** Escapes a plain word for use in a RegExp. */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Removes requirement IDs before looking for numbers. */
const withoutIds = (text) => text.replace(/\b[A-Z]{1,10}-\d{1,5}\b/g, " ");
/** ADR status: value (first word, lower-case) and the line it was read from; null when absent. */
function adrStatus(doc) {
    const word = (text) => (/[A-Za-z]+/.exec(stripEmphasis(stripCodeSpans(text)))?.[0] ?? "").toLowerCase();
    const fm = doc.md.frontMatter?.values.status;
    if (fm?.value)
        return { value: word(fm.value), text: fm.value, line: fm.line };
    const blocks = doc.md.blocks;
    for (const b of blocks) {
        if (b.type === "heading")
            continue;
        const m = /^(?:\*\*|__)?status(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.*)$/i.exec(b.text);
        if (m && word(m[1]))
            return { value: word(m[1]), text: m[1], line: b.lineStart };
    }
    const index = blocks.findIndex((b) => b.type === "heading" && /^status\b/i.test(b.text));
    const next = index >= 0 ? blocks[index + 1] : undefined;
    if (next && next.type !== "heading" && word(next.text))
        return { value: word(next.text), text: next.text, line: next.lineStart };
    return null;
}
/** ADR rules for one ADR file. */
function adrRules(doc, config, adrPaths, adrNumbers) {
    const out = [];
    const headings = doc.md.blocks.filter((b) => b.type === "heading").map((b) => b.text.toLowerCase());
    const status = adrStatus(doc);
    const missing = [
        ...(status ? [] : ["status"]),
        ...config.designPackage.adrSections.filter((section) => !headings.some((h) => new RegExp(`^${escape(section)}(?![a-z])`).test(h))),
    ];
    if (missing.length > 0)
        out.push({
            rule: "adr-section-missing",
            summary: `ADR has no ${missing.join(", ")} section`,
            path: doc.path,
            locations: [{ lineStart: 1, lineEnd: 1, detail: missing.join(", "), excerptLine: null }],
            requirementIds: [],
            key: missing.join("|"),
        });
    if (status && !config.designPackage.adrStatuses.includes(status.value))
        out.push({
            rule: "adr-status-invalid",
            summary: `ADR status "${status.value}" is not one of ${config.designPackage.adrStatuses.join(", ")}`,
            path: doc.path,
            locations: [
                { lineStart: status.line, lineEnd: status.line, detail: status.value, excerptLine: status.line },
            ],
            requirementIds: [],
            key: status.value,
        });
    const candidates = doc.md.blocks.flatMap((b) => b.lines);
    const fm = doc.md.frontMatter?.values.status;
    if (fm)
        candidates.unshift({ line: fm.line, text: fm.value });
    for (const { line, text } of candidates) {
        const rest = /superseded by\b(.*)$/i.exec(stripCodeSpans(text))?.[1];
        if (rest === undefined)
            continue;
        const link = /\]\(([^)\s#]+)/.exec(rest)?.[1];
        let target = null;
        if (link !== undefined) {
            if (/^[a-z][a-z0-9+.-]*:/i.test(link))
                continue; // external URL: not interpreted
            const resolved = posix.normalize(posix.join(posix.dirname(doc.path), decodeURI(link)));
            if (!adrPaths.has(resolved))
                target = link;
        }
        else {
            const number = /\bADR[-\s#]?0*(\d{1,5})\b/i.exec(rest)?.[1];
            if (number === undefined)
                continue; // other wording is not interpreted
            if (!adrNumbers.has(Number(number)))
                target = `ADR-${number.padStart(4, "0")}`;
        }
        if (target === null)
            continue;
        out.push({
            rule: "adr-supersede-dangling",
            summary: `Superseded by ${target}, which is not among the analyzed ADRs`,
            path: doc.path,
            locations: [{ lineStart: line, lineEnd: line, detail: target, excerptLine: line }],
            requirementIds: [],
            key: target,
        });
    }
    return out;
}
/** Service-level NFRs without a number plus a percentile/percentage or window. */
function nfrWithoutSlo(doc) {
    return doc.items
        .filter((i) => i.kind === "non_functional" && SERVICE_LEVEL.test(i.body))
        .filter((i) => {
        const text = withoutIds(i.body);
        return !(hasNumber(text) && (PERCENT_OR_PERCENTILE.test(text) || WINDOW.test(text)));
    })
        .map((i) => ({
        rule: "nfr-without-slo",
        summary: `${i.id ?? "Non-functional requirement"} names a service-level quality without a measurable target`,
        path: doc.path,
        locations: [
            {
                lineStart: i.block.lineStart,
                lineEnd: i.block.lineEnd,
                detail: i.id ?? "NFR",
                excerptLine: i.block.lineStart,
            },
        ],
        requirementIds: i.id ? [i.id] : [],
        key: i.body,
    }));
}
/** SLO statements (SLO + a number) that name no indicator. */
function sloWithoutSli(doc) {
    const out = [];
    for (const block of doc.md.blocks) {
        if (block.type === "heading")
            continue;
        const text = stripCodeSpans(block.text);
        if (!/\bSLOs?\b/.test(text) || !hasNumber(withoutIds(text)) || INDICATOR.test(text))
            continue;
        const line = block.lines.find((l) => /\bSLOs?\b/.test(stripCodeSpans(l.text)))?.line ?? block.lineStart;
        const item = doc.items.find((i) => line >= i.block.lineStart && line <= i.block.lineEnd);
        out.push({
            rule: "slo-without-sli",
            summary: `SLO${item?.id ? ` in ${item.id}` : ""} names no measured indicator`,
            path: doc.path,
            locations: [{ lineStart: block.lineStart, lineEnd: block.lineEnd, detail: "SLO", excerptLine: line }],
            requirementIds: item?.id ? [item.id] : [],
            key: text,
        });
    }
    return out;
}
/** First line in the package that uses AI vocabulary, if any. */
function firstAiMention(members) {
    for (const doc of members)
        for (const block of doc.md.blocks)
            for (const l of block.lines) {
                const m = AI_VOCABULARY.exec(stripCodeSpans(l.text));
                if (m)
                    return { doc, line: l.line, term: m[0] };
            }
    return null;
}
/** Security and AI-governance headings per design package (non-ADR inputs sharing a directory). */
function packageRules(docs, config) {
    const packages = new Map();
    for (const doc of docs) {
        if (matchesAny(doc.path, config.designPackage.adrPaths))
            continue;
        const dir = posix.dirname(doc.path);
        packages.set(dir, [...(packages.get(dir) ?? []), doc]);
    }
    const out = [];
    for (const dir of [...packages.keys()].sort()) {
        const members = packages.get(dir).sort((a, b) => (a.path < b.path ? -1 : 1));
        const first = members[0];
        const headings = members.flatMap((d) => d.md.blocks.filter((b) => b.type === "heading").map((b) => b.text.toLowerCase()));
        const hasHeading = (words) => headings.some((h) => words.some((w) => h.includes(w)));
        const names = members.map((d) => posix.basename(d.path)).join(", ");
        if (!hasHeading(config.designPackage.securityHeadings))
            out.push({
                rule: "security-considerations-missing",
                summary: `No security or threat section in the design package (${names})`,
                path: first.path,
                locations: [
                    { lineStart: first.anchorLine, lineEnd: first.anchorLine, detail: dir, excerptLine: null },
                ],
                requirementIds: [],
                key: "package",
            });
        if (hasHeading(config.designPackage.aiGovernanceHeadings))
            continue;
        const mention = firstAiMention(members);
        if (mention)
            out.push({
                rule: "ai-governance-missing",
                summary: `Mentions "${mention.term}" but the design package has no AI-governance section`,
                path: mention.doc.path,
                locations: [
                    { lineStart: mention.line, lineEnd: mention.line, detail: mention.term, excerptLine: mention.line },
                ],
                requirementIds: [],
                key: "package",
            });
    }
    return out;
}
/** Required documents with no matching file under cwd. */
function requiredDocs(config, ctx) {
    if (ctx.files === null)
        return [];
    const files = ctx.files;
    const required = requiredDocuments(config.designPackage);
    return Object.keys(required)
        .sort()
        .filter((name) => !files.some((f) => matchesAny(f, required[name])))
        .map((name) => ({
        rule: "design-package-incomplete",
        summary: `No ${name} document found (${required[name].join(", ")})`,
        path: ctx.configPath,
        locations: [{ lineStart: 1, lineEnd: 1, detail: name, excerptLine: null }],
        requirementIds: [],
        key: name,
    }));
}
/** All design-package findings (only called when the profile is enabled). */
export function designRules(docs, config, ctx) {
    const adrPaths = new Set(docs.map((d) => d.path).filter((p) => matchesAny(p, config.designPackage.adrPaths)));
    const adrs = docs.filter((d) => isAdr(d.path, config));
    const adrNumbers = new Set(adrs.map((d) => Number(/^\d+/.exec(posix.basename(d.path))?.[0])));
    return [
        ...adrs.flatMap((d) => adrRules(d, config, adrPaths, adrNumbers)),
        ...docs.flatMap((d) => [...nfrWithoutSlo(d), ...sloWithoutSli(d)]),
        ...packageRules(docs, config),
        ...requiredDocs(config, ctx),
    ];
}
