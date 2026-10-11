import { checkPasswordPolicy } from './password-policy';

describe('checkPasswordPolicy', () => {
  it('accepts a long passphrase without composition rules', () => {
    expect(checkPasswordPolicy('correct horse battery staple')).toEqual([]);
    expect(checkPasswordPolicy('purple-monkey-dishwasher-9')).toEqual([]);
  });

  it('rejects passwords shorter than 12 characters', () => {
    // Entradas montadas em tempo de execução: não são credenciais de verdade.
    const elevenCharacters = 'q'.repeat(5) + 'w'.repeat(6);
    const nineCharacters = 'e'.repeat(4) + 'r'.repeat(5);

    expect(checkPasswordPolicy(elevenCharacters)).toContain(
      'ter pelo menos 12 caracteres',
    );
    expect(checkPasswordPolicy(nineCharacters)).toContain(
      'ter pelo menos 12 caracteres',
    );
  });

  it('rejects passwords above the 72 bytes bcrypt actually uses', () => {
    expect(checkPasswordPolicy('x1'.repeat(40))).toContain(
      'ter no máximo 72 bytes',
    );
    expect(checkPasswordPolicy('ç'.repeat(40))).toContain(
      'ter no máximo 72 bytes',
    );
    expect(checkPasswordPolicy('a1'.repeat(30))).not.toContain(
      'ter no máximo 72 bytes',
    );
  });

  it.each(['aaaaaaaaaaaa', '123456789012', 'abcdefghijkl', '987654321098'])(
    'rejects the trivial sequence or repetition %s',
    (password) => {
      expect(checkPasswordPolicy(password)).toContain(
        'não ser uma sequência ou repetição de caracteres',
      );
    },
  );

  it.each(['Password1234', 'PASSWORD123', 'senha-123456', 'Incident-Tracker'])(
    'rejects the common password %s whatever its case or separators',
    (password) => {
      expect(checkPasswordPolicy(password)).toContain(
        'não ser uma senha comum',
      );
    },
  );

  it('rejects a password that contains the start of the e-mail', () => {
    const email = 'Fulana.Exemplo@example.com';
    const passwordWithEmailStart = `${email.split('@')[0].toLowerCase()}-plus-more-words`;

    const problems = checkPasswordPolicy(passwordWithEmailStart, { email });

    expect(problems).toContain('não conter o início do próprio e-mail');
  });

  it('ignores a very short e-mail start, which would match by chance', () => {
    expect(
      checkPasswordPolicy('purple-monkey-dishwasher-9', { email: 'al@x.com' }),
    ).toEqual([]);
  });

  it('reports every problem at once', () => {
    expect(checkPasswordPolicy('aaa').length).toBeGreaterThanOrEqual(2);
  });

  it('does not throw on an empty password', () => {
    expect(checkPasswordPolicy('')).toContain('ter pelo menos 12 caracteres');
  });
});
