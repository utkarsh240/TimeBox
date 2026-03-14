import { redis } from '@/lib/redis'
import { Elysia, t } from 'elysia'
import { nanoid } from 'nanoid'
import { authMiddleware } from './auth'
import { Message, realtime } from '@/lib/realtime'

const ROOM_TTL_SECONDS = 60 * 10

const rooms = new Elysia({ prefix: "/room" }).post("/create", async () => {

    const roomId = nanoid()

    await redis.hset(`meta:${roomId}`, {
        connected: [],
        createdAt: Date.now(),

    })


    await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS)

    return { roomId }
}).get("/ttl", async ({ query }) => {
    const { roomId } = query
    const ttl = await redis.ttl(`meta:${roomId}`)
    return { ttl }
}, {
    query: t.Object({ roomId: t.String() })
}).delete("/", async ({ query }) => {
    const { roomId } = query

    await realtime.channel(roomId).emit("chat.destroy", { isDestroyed: true as const })

    await redis.del(`meta:${roomId}`)
    await redis.del(`messages:${roomId}`)

    return { ok: true }
}, {
    query: t.Object({ roomId: t.String() })
})

const messages = new Elysia({ prefix: "/messages" }).use(authMiddleware).post("/", async ({ body, auth }) => {

    const { sender, text } = body
    const { roomId } = auth

    const roomExists = await redis.exists(`meta:${roomId}`)

    if (!roomExists) {
        throw new Error("Room does not exist")
    }

    const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
    }

    await redis.rpush(`messages:${roomId}`, { ...message, token: auth.token })
    await realtime.channel(roomId).emit("chat.message", message)


    const remaining = await redis.ttl(`meta:${roomId}`)

    await redis.expire(`messages:${roomId}`, remaining)

    await redis.expire(`history:${roomId}`, remaining)

    await redis.expire(roomId, remaining)

}, {
    query: t.Object({ roomId: t.String() }),
    body: t.Object({
        sender: t.String({ maxLength: 100 }),
        text: t.String({ maxLength: 1000 }),
    })
}).get("/", async ({ auth }) => {
    const messages = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1)

    return {
        messages: messages.map((m) => ({
            ...m,
            token: m.token === auth.token ? auth.token : undefined,
        }))
    }
},
    { query: t.Object({ roomId: t.String() }) })

const app = new Elysia({ prefix: '/api' }).use(rooms).use(messages)

    .get("/user", { user: { name: "John" } })

export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch

export type App = typeof app 