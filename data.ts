import redis from "redis"
import NRP from "node-redis-pubsub"
import { StreamMessage } from "./proto/randomPackage/StreamMessage";
import { User } from "./proto/randomPackage/User";

const client = redis.createClient()

client.on("error", console.error)
client.on("connect", console.log)

const REDIS_KEYS = {
    broadcastRoom: "room:0:messages",
    users: "users",
};

type ErrCB<T> = (err: Error | null, data: T) => void;

export const addUser = (user: User, fn?: ErrCB<number>) => {
    client.rpush(REDIS_KEYS.users, JSON.stringify(user), fn)
}

export const listUsers = (fn: ErrCB<Array<User>>) => {
    client.lrange(REDIS_KEYS.users, 0, -1, (err, rows) => {
        if (err) return fn(err, [])

        const users: Array<User> = []
        for (const row of rows) {
            const user = JSON.parse(row) as User
            users.push(user);
        }
    fn(err, users);
    });
};

export const updateUser = (user: User, fn: ErrCB<unknown>) => {
    listUsers((err, users) => {
        if (err) return fn(err, null)
        const i = users.findIndex(u => u.id === user.id)
        if(i === -1) return fn(new Error("user was not found"), null)
        client.lset(REDIS_KEYS.users, i, JSON.stringify(user), fn)
    });
};

export const getUser = (id: number, fn: ErrCB<User>) => {
    listUsers((err, users) => {
        if (err) return fn(err, {})

        const idx = users.findIndex(u => u.id === id)
        if (idx === -1) return fn(new Error("user with id not found"), {})

        return fn(null, users[idx])
    })
}

// export type Message = {
//     userId: number,
//     message: string,
//     avatar: string,
// }

export const addMessageToRoom = (msg: StreamMessage, fn: ErrCB<number>) => {
    client.rpush(REDIS_KEYS.broadcastRoom, JSON.stringify(msg), fn)
}

export const listMessagesInRoom = (fn: ErrCB<Array<StreamMessage>>) => {
    client.lrange(REDIS_KEYS.broadcastRoom, 0 , -1, (err, rows) => {
        if (err) return fn(err, [])
        const msgs: Array<StreamMessage> = []
        for (const row of rows) {
            const msg = JSON.parse(row) as StreamMessage
            msgs.push(msg)
        }
        return fn(null, msgs)
    })
}

export const nrp = NRP({
    emitter: redis.createClient(),
    receiver: redis.createClient()
})