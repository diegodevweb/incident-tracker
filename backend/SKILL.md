# Backend Guidelines

## Contexto
Este backend usa NestJS com Prisma e integrações externas. Priorize separação clara entre controller, service, infraestrutura e persistência.

## Estrutura de responsabilidade
- Controller recebe a requisição, valida entrada HTTP e delega ao service.
- Service concentra regra de negócio e orquestra Prisma, auth e storage.
- Infraestrutura externa deve ser acessada por abstrações dedicadas, não espalhada pela aplicação.

## Auth e identidade
- Não use IDs presumidos, mocks ou valores de UI como fonte de verdade.
- Vínculos entre usuário e incidente devem partir de identidade real autenticada ou payload validado explicitamente.
- Sempre prefira dados reais do banco e da sessão/token sobre convenções locais do frontend.

## Upload e arquivos
- Para upload de arquivos, use `multipart/form-data`.
- Em NestJS, receba arquivos com `FileInterceptor` ou `FilesInterceptor`.
- Campos textuais podem coexistir com arquivos usando `@Body()` na mesma rota.
- Não armazene binários no banco.
- Salve o arquivo em object storage e persista apenas metadados e referência do objeto.

## Storage
- Use uma abstração de storage, como `StorageService`, desacoplada da regra de negócio.
- Em ambiente local, use storage S3-compatible, como MinIO.
- Em produção, a implementação deve poder apontar para AWS S3 por configuração.
- Trate `key` ou `storageKey` como identidade persistente do objeto.
- URLs assinadas devem ser geradas sob demanda e não tratadas como identificador definitivo.

## Prisma e retorno de entidades
- Ao retornar entidades com anexos, resolva a referência do storage para URL assinada somente no momento da resposta, quando necessário.
- Evite persistir URLs temporárias no banco.
- Ao evoluir schema, prefira campos explícitos como `storageKey`, `mimeType`, `originalFilename`, `sizeBytes` e `uploadedByUserId`.

## Evolução incremental
- Em mudanças grandes, implemente em camadas:
  1. controller
  2. service
  3. integração externa
  4. persistência
  5. resposta ao frontend
- Quando for preciso destravar rápido, uma adaptação temporária é aceitável, mas documente claramente o débito técnico e a evolução desejada.
