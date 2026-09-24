const EMULATOR_PORT = "9199";

/**
 * O emulador de Storage devolve URLs absolutas (`http://<host>:9199/...`)
 * — no celular isso é "mixed content" (página https, recurso http) ou
 * simplesmente não resolve (127.0.0.1 no celular é o próprio celular, não
 * o computador de dev). Troca pelo caminho relativo `/__storage/...`, que
 * o `next.config.ts` reescreve pro emulador do lado do SERVIDOR (sempre
 * alcança `127.0.0.1:9199` de verdade, não importa de que dispositivo/host
 * veio o pedido original). Em produção (Storage de verdade), a URL já é
 * pública — não mexe.
 */
export function toPublicStorageUrl(rawUrl: string): string {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS !== "true") return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (url.port !== EMULATOR_PORT) return rawUrl;
    return `/__storage${url.pathname}${url.search}`;
  } catch {
    return rawUrl;
  }
}
