// Fuso fixo por enquanto — todo lojista do piloto está no Brasil. Nomeado
// (não inline) pra virar `tenant.timezone` sem precisar caçar cada uso.
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/**
 * Chave `AAAA-MM-DD` de um instante, num fuso horário específico — não
 * usar `Date.toISOString()` (sempre UTC): 23h30 em Brasília já é
 * madrugada do dia seguinte em UTC, o que erraria o dia do documento de
 * estatísticas. `"sv-SE"` é um locale que já formata como `AAAA-MM-DD`
 * nativamente, sem parsing manual. Sem `server-only`: usado tanto em
 * código de servidor (lib/stats.ts) quanto em testes puros.
 */
export function dateKeyInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
