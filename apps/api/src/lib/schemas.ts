import { Type } from '@sinclair/typebox';

/**
 * Fecha en un schema de RESPUESTA. Prisma devuelve `Date`; el serializador de
 * Fastify la convierte a string ISO al responder. `Type.String()` hacia que el
 * type provider exigiera `string` y rechazara el `Date` que los handlers
 * devuelven. No usar en body ni querystring: ahi entra siempre un string.
 */
export const DateTime = () => Type.Unsafe<Date | string>({ type: 'string', format: 'date-time' });
