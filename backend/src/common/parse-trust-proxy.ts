const MAX_PROXY_HOPS = 10;

/**
 * Quantos proxies confiáveis existem entre o cliente e a API (ver `trust proxy`
 * do Express). 0 = ninguém: X-Forwarded-For é ignorado e o IP é o do socket.
 */
export function parseTrustProxy(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return 0;
  }

  const hops = Number(value);

  if (!Number.isInteger(hops) || hops < 0 || hops > MAX_PROXY_HOPS) {
    throw new Error(
      `TRUST_PROXY deve ser um inteiro entre 0 e ${MAX_PROXY_HOPS} (número de proxies na frente da API)`,
    );
  }

  return hops;
}
