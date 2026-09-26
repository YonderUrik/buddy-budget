import "server-only";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL non è definita. Copia .env.local.example in .env.local.");
}

// lazyConnect: la connessione parte al primo comando, non all'import del modulo. Serve alla build
// dell'immagine Docker (che importa i moduli con un REDIS_URL fittizio) e non cambia nulla a runtime.
export const redis = new Redis(redisUrl, { lazyConnect: true });
