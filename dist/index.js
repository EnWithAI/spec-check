// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Library entry point: programmatic analysis, renderers, config validation and the rule catalog.
 */
export { analyze } from "./analyze.js";
export { DEFAULT_CONFIG, loadConfigFile, validateConfig } from "./config.js";
export { ExitCode, SpecCheckError } from "./errors.js";
export { renderJson } from "./report/json.js";
export { renderMarkdown } from "./report/markdown.js";
export { renderSarif } from "./report/sarif.js";
export { RULES } from "./rules/rules.js";
export { TOOL_VERSION } from "./version.js";
