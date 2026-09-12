// Ampliaciones de tipos de Fastify para los decoradores propios de la API.
//
// Antes vivian dentro del cuerpo de authPlugin() y familyPlugin(), donde
// `declare module` no es valido y tsc cortaba antes de revisar nada.
// El `import type` de abajo hace que este archivo sea un modulo, y por lo
// tanto que el bloque `declare module 'fastify'` sea una ampliacion y no
// una redefinicion del paquete entero.

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';

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

declare module 'fastify' {
  interface FastifyInstance {
    // plugins/auth.ts
    hashPassword: (password: string) => Promise<string>;
    verifyPassword: (password: string, hash: string) => Promise<boolean>;
    generateAccessToken: (user: { id: string; familyId: string; role: string }) => string;
    generateRefreshToken: (user: { id: string; familyId: string }) => string;
    parseToken: (
      token: string,
    ) => { sub: string; familyId: string; role: string; type: string; exp: number } | null;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

    // plugins/family.ts
    familyPrisma: (familyId: string) => PrismaClient;

    // socket/index.ts
    io: SocketIOServer;
  }

  interface FastifyRequest {
    user: AuthenticatedUser | null;
    family: RequestFamily | null;
  }
}
