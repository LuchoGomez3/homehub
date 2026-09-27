import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import fp from 'fastify-plugin';
import { ACCESS_COOKIE } from '../lib/tokens.js';
import { verifyAccessSession } from '../lib/session.js';

const BEARER = 'Bearer ';

/**
 * Rutas que no exigen access token. Se comparan por prefijo contra la URL
 * sin query string. /api/auth/refresh y /logout autentican por refresh
 * token, que se valida en la propia ruta.
 */
const PUBLIC_PREFIXES = [
  '/health',
  '/docs',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/invitations/accept',
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function extractAccessToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith(BEARER)) return header.slice(BEARER.length);
  return request.cookies?.[ACCESS_COOKIE] ?? null;
}

async function auth(fastify: FastifyInstance) {
  fastify.decorate('hashPassword', hashPassword);
  fastify.decorate('verifyPassword', verifyPassword);
  // `request.user` no se decora aca: ya lo hace @fastify/jwt al registrarse,
  // y decorarlo dos veces tira FST_ERR_DEC_ALREADY_PRESENT al arrancar.

  fastify.addHook('preHandler', async (request) => {
    const path = request.url.split('?')[0];
    if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return;

    const token = extractAccessToken(request);
    if (!token) {
      throw fastify.httpErrors.unauthorized('Authentication required');
    }

    // Firma, tipo y sesion viva (lib/session.ts). Un token invalido,
    // vencido, de otro secreto o de una sesion revocada muere aca.
    const session = await verifyAccessSession(fastify, token);
    if (!session) {
      throw fastify.httpErrors.unauthorized('Invalid or expired session');
    }

    request.user = session.user;
  });

  fastify.decorate('requireAdmin', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (request.user?.role !== 'ADMIN') {
      throw fastify.httpErrors.forbidden('Admin access required');
    }
  });
}

/**
 * Envuelto en fastify-plugin para que el hook y los decoradores no queden
 * encapsulados: sin esto no alcanzan a las rutas que se registran despues
 * en server.ts, y ninguna ruta queda protegida.
 */
export const authPlugin = fp(auth, {
  name: 'auth',
  dependencies: ['@fastify/sensible', '@fastify/cookie', '@fastify/jwt'],
});
