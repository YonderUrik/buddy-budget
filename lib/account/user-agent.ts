/** Descrizione leggibile di un dispositivo a partire dallo user agent, per l'elenco delle sessioni attive. */
export interface DeviceDescription {
  browser: string;
  os: string;
  mobile: boolean;
}

const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/Edg(A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

/** Riconosce browser e sistema operativo in modo volutamente grossolano (basta a riconoscere i propri dispositivi). */
export function describeUserAgent(userAgent: string | null | undefined): DeviceDescription {
  const ua = userAgent ?? "";
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? "Browser sconosciuto";
  const os = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? "sistema sconosciuto";
  return { browser, os, mobile: /Mobi|iPhone|Android/.test(ua) };
}

/** Etichetta breve, es. "Chrome su macOS". */
export function formatDevice(device: DeviceDescription): string {
  return `${device.browser} su ${device.os}`;
}
