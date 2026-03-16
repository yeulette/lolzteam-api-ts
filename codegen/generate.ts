#!/usr/bin/env ts-node
/**
 * codegen/generate.ts
 * -------------------
 * OpenAPI JSON → TypeScript API wrapper generator.
 *
 * Usage:
 *   npx ts-node codegen/generate.ts \
 *     --schema codegen/schemas/forum.json \
 *     --output src/forum/_generated.ts \
 *     --class ForumAPI
 */

import * as fs from "fs";
import * as path from "path";

// ── Types ──────────────────────────────────────────────────────────────────

interface OpenAPISpec {
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    parameters?: Record<string, ParameterObject>;
  };
}

interface PathItem {
  parameters?: Array<ParameterObject | RefObject>;
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
}

interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<ParameterObject | RefObject>;
  requestBody?: RequestBodyObject;
}

interface ParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
}

interface RefObject {
  $ref: string;
}

interface RequestBodyObject {
  required?: boolean;
  content: Record<string, { schema?: SchemaObject }>;
}

interface SchemaObject {
  type?: string;
  format?: string;
  $ref?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  anyOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  allOf?: SchemaObject[];
  description?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TS_KEYWORDS = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "import", "in", "instanceof", "new",
  "null", "return", "super", "switch", "this", "throw", "true", "try",
  "typeof", "var", "void", "while", "with", "as", "implements", "interface",
  "let", "package", "private", "protected", "public", "static", "yield",
  "type", "from", "of", "get", "set",
]);

function safeName(name: string): string {
  // Convert kebab-case / snake_case segments to camelCase
  const camel = name
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9_$]/g, "_");
  if (/^\d/.test(camel)) return "_" + camel;
  if (TS_KEYWORDS.has(camel)) return camel + "_";
  return camel;
}

function camelCase(str: string): string {
  return str
    .split(/[-_/]/)
    .map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)))
    .join("");
}

function pathToMethodName(urlPath: string, httpMethod: string): string {
  const parts = urlPath
    .split("/")
    .filter(Boolean)
    .map((p) => (p.startsWith("{") ? "By_" + p.slice(1, -1) : p));
  return camelCase(httpMethod.toLowerCase() + "_" + parts.join("_"));
}

function operationIdToMethod(opId: string): string {
  return safeName(camelCase(opId));
}

function oasTypeToTs(schema?: SchemaObject): string {
  if (!schema) return "unknown";
  if (schema.$ref) return "unknown"; // inline unknown for simplicity
  if (schema.anyOf || schema.oneOf || schema.allOf) return "unknown";
  switch (schema.type) {
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    case "array":
      return `${oasTypeToTs(schema.items)}[]`;
    case "object":
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

function resolveRef(ref: string, spec: OpenAPISpec): ParameterObject | undefined {
  const parts = ref.replace(/^#\//, "").split("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = spec;
  for (const part of parts) {
    if (!node || typeof node !== "object") return undefined;
    node = node[part];
  }
  return node as ParameterObject | undefined;
}

function collectParams(
  operation: OperationObject,
  pathItem: PathItem,
  spec: OpenAPISpec
): ParameterObject[] {
  const merged = new Map<string, ParameterObject>();

  function add(raw: ParameterObject | RefObject) {
    const p = "$ref" in raw ? resolveRef(raw.$ref, spec) : raw;
    if (p?.name) merged.set(p.name, p);
  }

  (pathItem.parameters ?? []).forEach(add);
  (operation.parameters ?? []).forEach(add);
  return [...merged.values()];
}

// ── Main generator ─────────────────────────────────────────────────────────

interface Operation {
  methodName: string;
  httpMethod: string;
  urlPath: string;
  summary?: string;
  pathParams: ParameterObject[];
  requiredQuery: ParameterObject[];
  optionalQuery: ParameterObject[];
  requiredBody: Array<[string, SchemaObject]>;
  optionalBody: Array<[string, SchemaObject]>;
  hasBody: boolean;
}

function generate(schemaPath: string, outputPath: string, className: string): void {
  const spec: OpenAPISpec = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  const operations: Operation[] = [];
  const seenNames = new Map<string, number>();

  for (const [urlPath, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const httpMethod of ["get", "post", "put", "patch", "delete"] as const) {
      const operation = pathItem[httpMethod];
      if (!operation) continue;

      const opId = operation.operationId;
      let methodName = opId ? operationIdToMethod(opId) : pathToMethodName(urlPath, httpMethod);

      // Deduplicate
      const count = seenNames.get(methodName) ?? 0;
      seenNames.set(methodName, count + 1);
      if (count > 0) methodName = `${methodName}_${count}`;

      const params = collectParams(operation, pathItem, spec);
      const pathParams = params.filter((p) => p.in === "path");
      const queryParams = params.filter((p) => p.in === "query");
      const requiredQuery = queryParams.filter((p) => p.required);
      const optionalQuery = queryParams.filter((p) => !p.required);

      // Request body
      let requiredBody: Array<[string, SchemaObject]> = [];
      let optionalBody: Array<[string, SchemaObject]> = [];
      let hasBody = false;

      const rb = operation.requestBody;
      if (rb) {
        const content = rb.content;
        const mediaType =
          content["application/json"] ??
          content["application/x-www-form-urlencoded"] ??
          content["multipart/form-data"];

        if (mediaType?.schema) {
          let schema = mediaType.schema;
          if (schema.$ref) {
            const resolved = resolveRef(schema.$ref, spec);
            if (resolved) schema = resolved as unknown as SchemaObject;
          }
          hasBody = true;
          const required = new Set(schema.required ?? []);
          for (const [name, propSchema] of Object.entries(schema.properties ?? {})) {
            if (required.has(name)) {
              requiredBody.push([name, propSchema]);
            } else {
              optionalBody.push([name, propSchema]);
            }
          }
        }
      }

      operations.push({
        methodName,
        httpMethod: httpMethod.toUpperCase(),
        urlPath,
        summary: operation.summary,
        pathParams,
        requiredQuery,
        optionalQuery,
        requiredBody,
        optionalBody,
        hasBody,
      });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const lines: string[] = [
    "// This file is AUTO-GENERATED by codegen/generate.ts",
    "// Do not edit manually – re-run the generator instead.",
    "//",
    `// npx ts-node codegen/generate.ts --schema ${path.basename(schemaPath)} --output ${path.basename(outputPath)} --class ${className}`,
    "",
    'import { ApiMixin } from "../core/mixin";',
    "",
    `export class ${className} extends ApiMixin {`,
    "",
  ];

  for (const op of operations) {
    // Build params interface
    const fields: string[] = [];

    for (const p of op.pathParams) {
      fields.push(`${safeName(p.name)}: ${oasTypeToTs(p.schema)}`);
    }
    for (const p of op.requiredQuery) {
      fields.push(`${safeName(p.name)}: ${oasTypeToTs(p.schema)}`);
    }
    for (const [name, schema] of op.requiredBody) {
      fields.push(`${safeName(name)}: ${oasTypeToTs(schema)}`);
    }
    for (const p of op.optionalQuery) {
      fields.push(`${safeName(p.name)}?: ${oasTypeToTs(p.schema)}`);
    }
    for (const [name, schema] of op.optionalBody) {
      fields.push(`${safeName(name)}?: ${oasTypeToTs(schema)}`);
    }

    const hasParams = fields.length > 0;
    const allOptional =
      op.pathParams.length === 0 &&
      op.requiredQuery.length === 0 &&
      op.requiredBody.length === 0;

    const paramsArg = hasParams
      ? allOptional
        ? `params: { ${fields.join("; ")} } = {}`
        : `params: { ${fields.join("; ")} }`
      : "";

    // JSDoc
    if (op.summary) {
      lines.push(`  /** ${op.summary} */`);
    }

    lines.push(`  ${op.methodName}(${paramsArg}): Promise<Response> {`);

    // Build URL (replace path params)
    let builtPath = op.urlPath;
    for (const p of op.pathParams) {
      builtPath = builtPath.replace(`{${p.name}}`, `\${params.${safeName(p.name)}}`);
    }
    const pathLiteral = op.pathParams.length > 0 ? `\`${builtPath}\`` : `"${builtPath}"`;

    // Build request options
    const optParts: string[] = [];

    // query params
    const queryNames = [...op.requiredQuery, ...op.optionalQuery].map((p) => safeName(p.name));
    if (queryNames.length > 0) {
      const entries = queryNames.map((n) => {
        const orig = [...op.requiredQuery, ...op.optionalQuery].find(
          (p) => safeName(p.name) === n
        )!.name;
        return orig === n ? n : `"${orig}": params.${n}`;
      });
      // Build params object excluding path params
      const allQueryFields = [...op.requiredQuery, ...op.optionalQuery]
        .map((p) => {
          const sn = safeName(p.name);
          return p.name === sn ? sn : `"${p.name}": params.${sn}`;
        })
        .join(", ");

      if (op.pathParams.length > 0) {
        // destructure path params out, rest is query
        const pathNames = op.pathParams.map((p) => safeName(p.name)).join(", ");
        lines.push(`    const { ${pathNames}, ...query } = params;`);
        optParts.push("params: query");
      } else {
        optParts.push("params");
      }
    } else if (op.pathParams.length > 0 && (op.requiredBody.length > 0 || op.optionalBody.length > 0)) {
      const pathNames = op.pathParams.map((p) => safeName(p.name)).join(", ");
      lines.push(`    const { ${pathNames}, ...body } = params;`);
    } else if (op.pathParams.length > 0) {
      // path only, nothing extra needed
    }

    // body params
    if (op.hasBody && (op.requiredBody.length > 0 || op.optionalBody.length > 0)) {
      if (op.pathParams.length > 0 && queryNames.length === 0) {
        optParts.push("json: body");
      } else if (op.pathParams.length === 0) {
        optParts.push("json: params");
      } else {
        optParts.push("json: params");
      }
    }

    const optStr = optParts.length > 0 ? `, { ${optParts.join(", ")} }` : "";

    lines.push(`    return this._request("${op.httpMethod}", ${pathLiteral}${optStr});`);
    lines.push("  }");
    lines.push("");
  }

  lines.push("}");
  lines.push("");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅  Generated ${operations.length} methods → ${outputPath}`);
}

// ── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && argv[i + 1]) {
      result[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));

if (!args.schema || !args.output || !args.class) {
  console.error("Usage: ts-node generate.ts --schema <file> --output <file> --class <Name>");
  process.exit(1);
}

generate(args.schema, args.output, args.class);
