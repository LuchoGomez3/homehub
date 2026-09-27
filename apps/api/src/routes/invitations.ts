import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';
import { DateTime } from '../lib/schemas.js';
import { randomBytes } from 'node:crypto';
import { inviteUserSchema, acceptInvitationSchema, UserRole } from '@homehub/shared';
import { env } from '../config/env.js';

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
      response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ user: Type.Object({ id: Type.String(), email: Type.String(), name: Type.String(), role: Type.String(), familyId: Type.String(), avatar: Type.Union([Type.String(), Type.Null()]), language: Type.String(), theme: Type.String() }), accessToken: Type.String(), refreshToken: Type.String() }) }) },
    },
  }, async (request, reply) => {
    const { token, password, name } = request.body;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { family: true },
    });

    if (!invitation) throw fastify.httpErrors.notFound('Invalid invitation');
    if (invitation.acceptedAt) throw fastify.httpErrors.conflict('Invitation already accepted');
    if (invitation.expiresAt < new Date()) throw fastify.httpErrors.gone('Invitation expired');

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email: invitation.email } });

    if (user) {
      // Add to family if not already
      if (user.familyId !== invitation.familyId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { familyId: invitation.familyId, role: invitation.role },
        });
      }
    } else {
      // Create new user
      const passwordHash = await fastify.hashPassword(password);
      user = await prisma.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          name,
          role: invitation.role,
          familyId: invitation.familyId,
        },
      });
    }

    await prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });

    const accessToken = fastify.generateAccessToken(user);
    const refreshToken = fastify.generateRefreshToken(user);

    reply.setCookie('accessToken', accessToken.replace('Bearer ', ''), { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60, path: '/' });
    reply.setCookie('refreshToken', refreshToken.replace('Bearer ', ''), { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/' });

    return { success: true, data: { user: { ...user, passwordHash: undefined }, accessToken, refreshToken } };
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
