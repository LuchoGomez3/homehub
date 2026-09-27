/** Sala de una sesion: logout la vacia para cortar sus sockets. */
export const sessionRoom = (sid: string) => `session:${sid}`;

/** Sala de un usuario: el reuso de refresh la vacia (todas sus sesiones). */
export const userRoom = (userId: string) => `user:${userId}`;
