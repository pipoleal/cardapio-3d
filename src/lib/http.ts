/**
 * Só navegação de verdade (documento) deve atualizar cookies "pegajosos"
 * (locale, origem). O `<Link>` do LanguageSwitcher, por exemplo, faz
 * prefetch de /en e /es em segundo plano assim que a página carrega — sem
 * essa checagem, esse prefetch sobrescreveria o cookie do usuário sem ele
 * ter navegado de verdade. Mesmo truque do next-intl (ver syncCookie.js do
 * pacote): `sec-fetch-dest` só falta em clientes que não são navegador
 * (curl, scripts de teste), por isso ausência também conta como documento.
 */
export function isDocumentNavigation(secFetchDest: string | null): boolean {
  return secFetchDest === null || secFetchDest === "document";
}
