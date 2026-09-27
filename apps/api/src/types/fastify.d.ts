// Ampliaciones de tipos para los decoradores propios de la API.
//
// El `import type` de abajo hace que este archivo sea un modulo, y por lo
// tanto que los bloques `declare module` sean ampliaciones y no
// redefiniciones del paquete entero.

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';

/** Lo que las rutas ven en `request.user` una vez autenticado. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  familyId: string;
  avatar: string | null;
  language: string;
  theme: string;
}

export interface RequestFamily {
  id: string;
  name: string;
}

/**
 * Cuerpo de los JWT. `type` distingue access de refresh para que un token
 * de un tipo nunca sirva donde se espera el otro, aun compartiendo forma.
 * `jti` solo va en los refresh: identifica la fila de RefreshToken.
 */
export interface TokenPayload {
  sub: string;
  familyId: string;
  role: string;
  type: 'access' | 'refresh';
  jti?: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: AuthenticatedUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    // plugins/auth.ts
    hashPassword: (password: string) => Promise<string>;
    verifyPassword: (password: string, hash: string) => Promise<boolean>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

    // plugins/family.ts
    familyPrisma: (familyId: string) => PrismaClient;

    // socket/index.ts
    io: SocketIOServer;
  }

  interface FastifyRequest {
    // `user` lo declara @fastify/jwt a partir de FastifyJWT['user'].
    family: RequestFamily | null;
  }
}
