import { channelOptionsEqual } from '@grpc/grpc-js/build/src/channel-options'
import {nrp} from './data'
import { StreamMessage } from './proto/randomPackage/StreamMessage'
import {User} from './proto/randomPackage/User'

const REDIS_CHANNELS =  {
    mainRoom: "MAIN_ROOM",
    userChange: "USER_CHANGE"
}

export type listenFnCB<T> = (data: T, channel: string) => void

export const emitMainChatRoomUpdate = (msg: StreamMessage) => {
    nrp.emit(REDIS_CHANNELS.mainRoom, JSON.stringify(msg))
}

export const listenMainChatRoomUpdate = (fn: listenFnCB<StreamMessage>) => {
    nrp.on(REDIS_CHANNELS.mainRoom, (data, channel) => {
        const msg = JSON.parse(data) as StreamMessage
        fn(msg, channel)
    })
}

export const emitUserUpdate = (user: User) => {
    nrp.emit(REDIS_CHANNELS.userChange, JSON.stringify(user))
}

export const listenUserUpdate = (fn: listenFnCB<User>) => {
    nrp.on(REDIS_CHANNELS.userChange, (data, channel) => {
        const msg = JSON.parse(data) as User
        fn(msg, channel)
    })
}
