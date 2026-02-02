const normalizeKey = (key) => key.toLowerCase();

const resolveValue = (context, rawKey) => {
  const key = normalizeKey(rawKey);
  const normalizedContext = Object.keys(context).reduce((acc, current) => {
    acc[normalizeKey(current)] = context[current];
    return acc;
  }, {});

  if (key in normalizedContext) {
    return normalizedContext[key];
  }

  if (key === "nome" && normalizedContext.name) {
    return normalizedContext.name;
  }

  return undefined;
};

const renderString = (value, context) => {
  if (typeof value !== "string") return value;

  let rendered = value;

  rendered = rendered.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
    const resolved = resolveValue(context, key);
    return resolved !== undefined ? String(resolved) : match;
  });

  rendered = rendered.replace(/%([^%]+?)%/g, (match, key) => {
    const resolved = resolveValue(context, key);
    return resolved !== undefined ? String(resolved) : match;
  });

  rendered = rendered.replace(/\{\s*([^}]+?)\s*\}/g, (match, key) => {
    const resolved = resolveValue(context, key);
    return resolved !== undefined ? String(resolved) : match;
  });

  return rendered;
};

export const renderTemplate = (template, context) => {
  if (Array.isArray(template)) {
    return template.map((item) => renderTemplate(item, context));
  }

  if (template && typeof template === "object") {
    return Object.entries(template).reduce((acc, [key, value]) => {
      acc[key] = renderTemplate(value, context);
      return acc;
    }, {});
  }

  return renderString(template, context);
};
