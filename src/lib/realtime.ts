import {z} from "zod";
import { redis } from "@/lib/redis";

import { Realtime, InferRealtimeEvents } from "@upstash/realtime";


const message = z.object({
    id: z.string(),
    sender: z.string(),
    text: z.string(),
    timeStamp: z.number(),
    roomId: z.string(),
    token: z.string().optional(),
})

const  schema = {
    chat: {
        message,
        destroy: z.object({
            isDestroyed: z.literal(true),

        }),
    }
}


export const realtime = new Realtime({schema, redis})

export type RealtimeEvents= InferRealtimeEvents<typeof realtime>


export type Message = z.infer<typeof message>