const normalizeKey = (key: string) => key.toLowerCase();

const resolveValue = (context: Record<string, any>, rawKey: string) => {
  const key = normalizeKey(rawKey).trim(); // Trim extra spaces!
  
  if (Object.prototype.hasOwnProperty.call(context, rawKey)) {
    return context[rawKey];
  }

  // Debug: Se quiser ver o que está acontecendo no log, descomente:
  // console.log(`[Resolving] Key: '${key}', ContextKeys:`, Object.keys(context));

  const normalizedContext = Object.keys(context).reduce((acc, current) => {
    acc[normalizeKey(current)] = context[current];
    return acc;
  }, {} as Record<string, any>);

  if (key in normalizedContext) {
    return normalizedContext[key];
  }

  if (key === "nome" && normalizedContext.name) return normalizedContext.name;
  if (key === "telefone" && normalizedContext.number) return normalizedContext.number;

  return undefined;
};

export const renderTemplate = (value: any, context: Record<string, any>): any => {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => renderTemplate(item, context));
  }

  if (typeof value === "object") {
    const result: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = renderTemplate(value[key], context);
      }
    }
    return result;
  }

  if (typeof value !== "string") return value;

  let rendered = value;

  rendered = rendered.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
    const resolved = resolveValue(context, key);
    return resolved !== undefined ? String(resolved) : match;
  });

  return rendered;
};
