import { useState } from "react";

/**
 * Valor de um campo de formulário que acompanha o que veio do servidor (quando
 * o card é atualizado, por exemplo) enquanto a pessoa não mexeu nele. O que ela
 * já editou não é sobrescrito.
 */
export function useServerDraft<T>(serverValue: T) {
  const [draft, setDraft] = useState(serverValue);
  const [base, setBase] = useState(serverValue);

  if (!Object.is(base, serverValue)) {
    setBase(serverValue);

    if (Object.is(draft, base)) {
      setDraft(serverValue);
    }
  }

  return [draft, setDraft] as const;
}
