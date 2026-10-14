/** 12.ABC.345/01DE-35: a API guarda os 14 caracteres sem pontuação. */
export function formatCnpj(cnpj: string) {
  return cnpj.replace(
    /^(.{2})(.{3})(.{3})(.{4})(.{2})$/,
    "$1.$2.$3/$4-$5",
  );
}
