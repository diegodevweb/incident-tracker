import { isValidCnpj, normalizeCnpj } from './cnpj';

describe('CNPJ', () => {
  it('normalizes punctuation, spaces and lowercase letters', () => {
    expect(normalizeCnpj(' 11.222.333/0001-81 ')).toBe('11222333000181');
    expect(normalizeCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  it('accepts a valid numeric CNPJ', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  // Exemplo da Receita/Serpro para o CNPJ alfanumérico.
  it('accepts a valid alphanumeric CNPJ', () => {
    expect(isValidCnpj('12ABC34501DE35')).toBe(true);
  });

  it.each([
    ['a wrong first check digit', '11222333000191'],
    ['a wrong second check digit', '11222333000182'],
    ['a wrong alphanumeric check digit', '12ABC34501DE36'],
    ['letters in the check digits', '12ABC34501DE3A'],
    ['13 characters', '1122233300018'],
    ['15 characters', '112223330001810'],
    ['lowercase letters (not normalized)', '12abc34501de35'],
    ['punctuation (not normalized)', '11.222.333/0001-81'],
    ['all digits equal', '00000000000000'],
    ['all digits equal, not zero', '11111111111111'],
  ])('rejects %s', (_, cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(false);
  });
});
