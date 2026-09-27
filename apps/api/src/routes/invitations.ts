import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';
import { DateTime } from '../lib/schemas.js';
import { randomBytes } from 'node:crypto';
import { inviteUserSchema, acceptInvitationSchema, UserRole } from '@homehub/shared';
import { issueSession } from '../lib/tokens.js';

const inviteBody = Type.Object({
  email: Type.String({ format: 'email' }),
  role: Type.Optional(Type.Union([Type.Literal('ADMIN'), Type.Literal('MEMBER')])),
});

const invitationResponse = Type.Object({
  id: Type.String(),
  email: Type.String(),
  role: Type.String(),
  familyId: Type.String(),
  invitedById: Type.String(),
  token: Type.String(),
  expiresAt: DateTime(),
  acceptedAt: Type.Union([DateTime(), Type.Null()]),
  createdAt: DateTime(),
});

export const invitationRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Invite user (admin only)
  fastify.post('/', {
    schema: { body: inviteBody, response: { 201: Type.Object({ success: Type.Boolean(), data: invitationResponse }) } },
    preHandler: [fastify.requireAdmin],
  }, async (request, reply) => {
    const { email, role = 'MEMBER' } = request.body;

    // Check if user already exists in family
    const existingUser = await prisma.user.findFirst({
      where: { email, familyId: request.family!.id },
    });
    if (existingUser) {
      throw fastify.httpErrors.conflict('User already in family');
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: { email, familyId: request.family!.id, acceptedAt: null },
    });
    if (existingInvite) {
      throw fastify.httpErrors.conflict('Invitation already pending');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        email,
        role,
        familyId: request.family!.id,
        invitedById: request.user!.id,
        token,
        expiresAt,
      },
    });

    // TODO: Send invitation email
    // await sendInvitationEmail(email, token, request.family!.name);

    return reply.status(201).send({ success: true, data: invitation });
  });

  // List pending invitations (admin only)
  fastify.get('/', {
    schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Array(invitationResponse) }) } },
    preHandler: [fastify.requireAdmin],
  }, async (request) => {
    const invitations = await prisma.invitation.findMany({
      where: { familyId: request.family!.id, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: invitations };
  });

  // Accept invitation (public)
  fastify.post('/accept', {
    schema: {
      body: Type.Object({ token: Type.String(), password: Type.String({ minLength: 8 }), name: Type.String({ minLength: 1, maxLength: 100 }) }),
      response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ user: Type.Object({ id: Type.String(), email: Type.String(), name: Type.String(), role: Type.String(), familyId: Type.String(), avatar: Type.Union([Type.String(), Type.Null()]), language: Type.String(), theme: Type.String() }) }) }) },
    },
  }, async (request, reply) => {
    const { token, password, name } = request.body;

    const invitation = await prisma.invitation.findUnique({ where: { token } });

    if (!invitation) throw fastify.httpErrors.notFound('Invalid invitation');
    if (invitation.acceptedAt) throw fastify.httpErrors.conflict('Invitation already accepted');
    if (invitation.expiresAt < new Date()) throw fastify.httpErrors.gone('Invitation expired');

    // Una invitacion no puede mover una cuenta existente a otra familia: el
    // token no prueba que quien lo usa sea el duenio del email. Esa persona
    // tiene que iniciar sesion; aceptar desde adentro todavia no existe.
    const existing = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    if (existing) {
      throw fastify.httpErrors.conflict('Account already exists. Log in to accept this invitation.');
    }

    const passwordHash = await fastify.hashPassword(password);

    // Reclamar la invitacion y crear el usuario en la misma transaccion: si
    // dos requests llegan con el mismo token, solo uno pasa el updateMany.
    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw fastify.httpErrors.conflict('Invitation already accepted');
      }
      return tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          name,
          role: invitation.role,
          familyId: invitation.familyId,
        },
        select: { id: true, email: true, name: true, role: true, familyId: true, avatar: true, language: true, theme: true },
      });
    });

    await issueSession(fastify, reply, user);
    return { success: true, data: { user } };
  });

  // Cancel invitation (admin only)
  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ message: Type.String() }) }) } },
    preHandler: [fastify.requireAdmin],
  }, async (request, reply) => {
    await prisma.invitation.delete({ where: { id: request.params.id, familyId: request.family!.id } });
    return { success: true, data: { message: 'Invitation cancelled' } };
  });
};
