/** Preferencias de interfaz. Se guardan en el dispositivo (localStorage). */
export type Theme = "system" | "light" | "dark";
export type TextSize = "normal" | "large";
export type Prefs = { theme: Theme; size: TextSize };

const KEY = "ax_prefs";
const DEFAULTS: Prefs = { theme: "system", size: "normal" };

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* almacenamiento bloqueado: se aplica solo en esta visita */
  }
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.size = prefs.size;
}

/**
 * Se ejecuta en <head> antes de pintar la página, para que el tema elegido
 * no parpadee al cargar. Debe ser autosuficiente (va como texto en el HTML).
 */
export const PREFS_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("${KEY}")||"{}"),r=document.documentElement;r.dataset.theme=p.theme||"system";r.dataset.size=p.size||"normal"}catch(e){}`;
