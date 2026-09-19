/** Replace `{{name}}` placeholders. Missing or unused variables are errors, so prompts never ship half-filled. */
export function renderTemplate(template: string, vars: Readonly<Record<string, string>>): string {
  const used = new Set<string>();
  const out = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => {
    const v = vars[name];
    if (v === undefined) throw new Error(`Prompt variable "${name}" is missing`);
    used.add(name);
    return v;
  });
  const unused = Object.keys(vars).filter((k) => !used.has(k));
  if (unused.length > 0) throw new Error(`Prompt variables not used: ${unused.join(", ")}`);
  return out;
}
