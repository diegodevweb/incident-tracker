import { Prisma } from '@prisma/client';

/**
 * Como a conversa é carregada no detalhe do chamado. Do autor saem o nome e o
 * papel: o papel diz de que lado veio a mensagem, e o e-mail não vai junto.
 */
export const INCIDENT_COMMENTS_QUERY = {
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  include: { author: { select: { name: true, role: true } } },
} satisfies Prisma.Incident$commentsArgs;

type IncidentCommentRow = Prisma.IncidentCommentGetPayload<{
  include: typeof INCIDENT_COMMENTS_QUERY.include;
}>;

export function toPublicIncidentComment(comment: IncidentCommentRow) {
  return {
    id: comment.id,
    message: comment.message,
    createdAt: comment.createdAt,
    authorName: comment.author.name,
    authorRole: comment.author.role,
  };
}
