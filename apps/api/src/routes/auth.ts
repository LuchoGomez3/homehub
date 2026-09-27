import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';
import {
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  clearSessionCookies,
  hashToken,
  newTokenId,
  refreshJwt,
  setSessionCookies,
  signAccessToken,
  signRefreshToken,
} from '../lib/tokens.js';
import type { TokenPayload } from '../types/fastify.js';

// ---------------------------------------------------------------------------
// Esquemas
// ---------------------------------------------------------------------------

const loginBody = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String(),
});

const registerBody = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  familyName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
});

const userSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.String(),
  role: Type.String(),
  familyId: Type.String(),
  avatar: Type.Union([Type.String(), Type.Null()]),
  language: Type.String(),
  theme: Type.String(),
});

// Los tokens NO forman parte de la respuesta: viajan solo en cookies
// httpOnly (decisions/0001). Si no estan en el JSON, el cliente no puede
// guardarlos en localStorage aunque quiera.
const sessionResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({ user: userSchema }),
});

const meResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    user: userSchema,
    family: Type.Object({ id: Type.String(), name: Type.String() }),
  }),
});

const messageResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({ message: Type.String() }),
});

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  familyId: true,
  avatar: true,
  language: true,
  theme: true,
} as const;

type SessionUser = { id: string; familyId: string; role: string };

// ---------------------------------------------------------------------------
// Emision de sesion
// ---------------------------------------------------------------------------

/**
 * Firma el par access/refresh, persiste el hash del refresh y deja las dos
 * cookies en la respuesta. `replaces` encadena el refresh nuevo al que rota.
 */
async function issueSession(
  fastify: FastifyInstance,
  reply: FastifyReply,
  user: SessionUser,
  replaces?: { id: string },
): Promise<void> {
  const jti = newTokenId();
  const accessToken = signAccessToken(fastify, user);
  const refreshToken = signRefreshToken(fastify, user, jti);

  const created = await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
    select: { id: true },
  });

  if (replaces) {
    await prisma.refreshToken.update({
      where: { id: replaces.id },
      data: { revokedAt: new Date(), replacedById: created.id },
    });
  }

  setSessionCookies(reply, accessToken, refreshToken);
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

export const authRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/login',
    { schema: { body: loginBody, response: { 200: sessionResponse } } },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await prisma.user.findUnique({
        where: { email },
        select: { ...userSelect, passwordHash: true },
      });

      // Mismo mensaje para "no existe" y "clave incorrecta": no se revela
      // que emails estan registrados.
      if (!user || !(await fastify.verifyPassword(password, user.passwordHash))) {
        throw fastify.httpErrors.unauthorized('Invalid credentials');
      }

      const { passwordHash: _omit, ...publicUser } = user;
      await issueSession(fastify, reply, publicUser);
      return { success: true, data: { user: publicUser } };
    },
  );

  fastify.post(
    '/register',
    { schema: { body: registerBody, response: { 201: sessionResponse } } },
    async (request, reply) => {
      const { email, password, name, familyName } = request.body;

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        throw fastify.httpErrors.conflict('Email already registered');
      }

      const passwordHash = await fastify.hashPassword(password);
      const family = await prisma.family.create({
        data: {
          name: familyName ?? `${name}'s Family`,
          members: { create: { email, passwordHash, name, role: 'ADMIN' } },
        },
        include: { members: { select: userSelect } },
      });

      const user = family.members[0];
      await issueSession(fastify, reply, user);
      return reply.status(201).send({ success: true, data: { user } });
    },
  );

  fastify.post(
    '/refresh',
    { schema: { response: { 200: sessionResponse } } },
    async (request, reply) => {
      const raw = request.cookies?.[REFRESH_COOKIE];
      if (!raw) {
        throw fastify.httpErrors.unauthorized('Refresh token required');
      }

      // 1. Firma y vencimiento del JWT.
      let payload: TokenPayload;
      try {
        payload = refreshJwt(fastify).verify<TokenPayload>(raw);
      } catch {
        clearSessionCookies(reply);
        throw fastify.httpErrors.unauthorized('Invalid refresh token');
      }
      if (payload.type !== 'refresh') {
        clearSessionCookies(reply);
        throw fastify.httpErrors.unauthorized('Wrong token type');
      }

      // 2. Estado del lado del servidor.
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(raw) },
        select: { id: true, userId: true, revokedAt: true, expiresAt: true },
      });

      if (!stored) {
        clearSessionCookies(reply);
        throw fastify.httpErrors.unauthorized('Unknown refresh token');
      }

      if (stored.revokedAt) {
        // Un token que ya roto vuelve a aparecer: alguien tiene una copia.
        // Se cierran todas las sesiones del usuario, no solo esta.
        await prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        clearSessionCookies(reply);
        throw fastify.httpErrors.unauthorized('Refresh token reuse detected');
      }

      if (stored.expiresAt < new Date()) {
        clearSessionCookies(reply);
        throw fastify.httpErrors.unauthorized('Refresh token expired');
      }

      const user = await prisma.user.findUnique({ where: { id: stored.userId }, select: userSelect });
      if (!user || user.familyId !== payload.familyId) {
        clearSessionCookies(reply);
        throw fastify.httpErrors.unauthorized('User not found');
      }

      // 3. Rotar: el nuevo reemplaza al viejo, que queda revocado.
      await issueSession(fastify, reply, user, { id: stored.id });
      return { success: true, data: { user } };
    },
  );

  fastify.post(
    '/logout',
    { schema: { response: { 200: messageResponse } } },
    async (request, reply) => {
      const raw = request.cookies?.[REFRESH_COOKIE];
      if (raw) {
        // Revocar por hash, sin verificar firma: si el token es basura no
        // matchea nada y no pasa nada. Logout es idempotente.
        await prisma.refreshToken.updateMany({
          where: { tokenHash: hashToken(raw), revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      clearSessionCookies(reply);
      return { success: true, data: { message: 'Logged out successfully' } };
    },
  );

  fastify.get('/me', { schema: { response: { 200: meResponse } } }, async (request) => {
    return {
      success: true,
      data: { user: request.user, family: request.family! },
    };
  });
};
