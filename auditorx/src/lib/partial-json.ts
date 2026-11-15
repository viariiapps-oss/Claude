/**
 * Interpreta un JSON que todavía se está recibiendo. Cierra las cadenas,
 * objetos y listas abiertos; si aun así no es válido (p. ej. termina en una
 * clave a medias), retrocede hasta la última coma y lo intenta de nuevo.
 */
export function parsePartialJson(text: string): unknown {
  const stack: string[] = [];
  const cuts: { at: number; closers: string }[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
    else if (ch === ",") cuts.push({ at: i, closers: [...stack].reverse().join("") });
  }

  const attempts = [text + (inString ? '"' : "") + [...stack].reverse().join("")];
  for (const cut of cuts.slice(-3).reverse()) attempts.push(text.slice(0, cut.at) + cut.closers);
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* siguiente intento */
    }
  }
  return null;
}
