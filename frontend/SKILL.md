# Frontend Guidelines

## Contexto
Este frontend usa App Router e pode estar rodando em uma versão de Next.js com mudanças relevantes em relação a versões anteriores. Antes de alterar comportamento estrutural, valide o padrão esperado no projeto e nos docs locais do Next.

## Server vs Client
- Use componentes server para receber `params` e `searchParams` e preparar props iniciais.
- Use componentes client para interatividade, leitura de `localStorage`, eventos de formulário e estado local.
- Quando `params` ou `searchParams` vierem como `Promise`, resolva com `await` no componente server.
- Evite usar hooks client-only em páginas server. Quando necessário, mova a lógica para um componente client.

## Sessão e identidade
- Não use `mockProfiles`, nomes hardcoded ou IDs fixos como fonte de verdade em fluxos autenticados.
- Para ações autenticadas no client, leia a sessão persistida e priorize `session.user.id`, `session.user.name` e `session.user.email`.
- Em fluxos de cliente, filtre tickets e crie incidentes com base no `user.id` autenticado.
- Querystring como `?role=CLIENT` é apenas contexto de UI, não prova de identidade.

## API e formulários
- Para payloads textuais simples, use JSON.
- Para uploads, use `FormData`.
- Quando usar `FormData`, não force `Content-Type`; deixe o navegador montar `multipart/form-data`.
- Mantenha a camada de API centralizada em utilitários como `lib/api.ts`.

## UI e semântica operacional
- Preserve enums técnicos do backend quando necessário, mas adapte os rótulos da UI ao contexto operacional.
- Para incidentes manuais (`DASHBOARD`), prefira linguagem operacional como `Baixa`, `Média`, `Alta`, `Crítica`.
- Para eventos técnicos ou integrações (`WEBHOOK`), mantenha rótulos técnicos como `Informativo`, `Aviso`, `Erro`, `Crítico`.

## Mock vs dado real
- Use mocks apenas como fallback visual ou para desenvolvimento isolado.
- Não permita que mocks determinem vínculo de usuário, autorização, filtragem principal ou persistência.
- Sempre que houver dado real disponível via API ou sessão, ele deve prevalecer sobre mock.
