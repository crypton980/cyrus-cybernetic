type ClassValue = string | number | boolean | null | undefined | ClassValue[] | Record<string, boolean>;

function flatten(inputs: ClassValue[]): string[] {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (Array.isArray(input)) {
      out.push(...flatten(input));
      continue;
    }
    if (typeof input === "object") {
      for (const [key, enabled] of Object.entries(input)) {
        if (enabled) out.push(key);
      }
      continue;
    }
    out.push(String(input));
  }
  return out;
}

export function cn(...inputs: ClassValue[]) {
  return flatten(inputs).join(" ");
}
