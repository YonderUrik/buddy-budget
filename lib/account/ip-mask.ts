/** Quanti hextet di un indirizzo IPv6 si conservano (/48): il resto identifica il singolo dispositivo e si azzera. */
const IPV6_KEPT_HEXTETS = 3;

/**
 * Tronca un indirizzo IP prima di salvarlo (minimizzazione, come indicano le linee guida del Garante per gli analytics):
 * IPv4 `a.b.c.d` → `a.b.c.0`, IPv6 → primi 3 gruppi e il resto a zero. Input non riconosciuto o vuoto → `null`
 * (meglio non salvare che salvare un valore che non sappiamo mascherare).
 */
export function truncateIp(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;

  const v4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0`;

  // Indirizzo IPv4 mappato su IPv6 (::ffff:a.b.c.d).
  const mapped = value.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/i);
  if (mapped) return `${mapped[1]}.${mapped[2]}.${mapped[3]}.0`;

  if (value.includes(":") && /^[0-9a-f:]+$/i.test(value) && !value.includes(":::")) {
    const [head, tail = ""] = value.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = value.includes("::") ? 8 - headParts.length - tailParts.length : 0;
    const full = [...headParts, ...Array<string>(Math.max(missing, 0)).fill("0"), ...tailParts];
    if (full.length !== 8) return null;
    return [...full.slice(0, IPV6_KEPT_HEXTETS), ...Array<string>(8 - IPV6_KEPT_HEXTETS).fill("0")].join(":");
  }
  return null;
}
