import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { JWT } from '@fastify/jwt';
import type { TokenPayload } from '../types/fastify.js';
import { prisma } from '../server.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const ACCESS_COOKIE = 'accessToken';
export const REFRESH_COOKIE = 'refreshToken';

/**
 * @fastify/jwt se registra dos veces con `namespace`, lo que en runtime deja
 * `fastify.jwt.access` y `fastify.jwt.refresh`; sus tipos no lo reflejan.
 * Este es el unico lugar donde se hace el cast.
 */
function namespaced(fastify: FastifyInstance, ns: 'access' | 'refresh'): JWT {
  return (fastify.jwt as unknown as Record<string, JWT>)[ns];
}

export function accessJwt(fastify: FastifyInstance): JWT {
  return namespaced(fastify, 'access');
}

export function refreshJwt(fastify: FastifyInstance): JWT {
  return namespaced(fastify, 'refresh');
}

/** SHA-256 en hex. Lo que se guarda en RefreshToken.tokenHash. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newTokenId(): string {
  return randomUUID();
}

type SessionUser = { id: string; familyId: string; role: string };

export function signAccessToken(fastify: FastifyInstance, user: SessionUser, sid: string): string {
  const payload: TokenPayload = {
    sub: user.id,
    familyId: user.familyId,
    role: user.role,
    type: 'access',
    sid,
  };
  return accessJwt(fastify).sign(payload);
}

export function signRefreshToken(fastify: FastifyInstance, user: SessionUser, jti: string): string {
  const payload: TokenPayload = {
    sub: user.id,
    familyId: user.familyId,
    role: user.role,
    type: 'refresh',
    jti,
  };
  return refreshJwt(fastify).sign(payload);
}

const secure = process.env.NODE_ENV === 'production';

/**
 * Las cookies son la unica salida de los tokens (decisions/0001). El refresh
 * queda acotado a /api/auth para que no viaje en cada request de la API.
 */
export function setSessionCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  reply.setCookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

/**
 * Firma el par access/refresh, persiste el hash del refresh y deja las dos
 * cookies en la respuesta. `replaces` encadena el refresh nuevo al que rota.
 * Es la unica forma de abrir una sesion: login, register, refresh y
 * invitations/accept pasan por aca.
 */
export async function issueSession(
  fastify: FastifyInstance,
  reply: FastifyReply,
  user: SessionUser,
  replaces?: { id: string },
): Promise<void> {
  // Un mismo id para la fila, el jti del refresh y el sid del access: los
  // dos tokens quedan atados a una sesion que se puede revocar.
  const jti = newTokenId();
  const accessToken = signAccessToken(fastify, user, jti);
  const refreshToken = signRefreshToken(fastify, user, jti);

  const created = await prisma.refreshToken.create({
    data: {
      id: jti,
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
