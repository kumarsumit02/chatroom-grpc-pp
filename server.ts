import path from 'path'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import {ProtoGrpcType} from './proto/random'
import { ChatServiceHandlers } from './proto/randomPackage/ChatService'
import { addMessageToRoom, addUser, getUser, listMessagesInRoom, listUsers, updateUser } from './data'
import {emitMainChatRoomUpdate, emitUserUpdate, listenMainChatRoomUpdate, listenUserUpdate} from './pubsub'
import { User } from "./proto/randomPackage/User";
import { Status } from "./proto/randomPackage/Status";
import { StreamMessage } from "./proto/randomPackage/StreamMessage";
import { StreamRequest__Output } from './proto/randomPackage/StreamRequest'
import { UserStreamResponse } from './proto/randomPackage/UserStreamResponse'

const PORT = 8082
const PROTO_FILE = './proto/random.proto'

const packageDef = protoLoader.loadSync(path.resolve(__dirname, PROTO_FILE))
const grpcObj = (grpc.loadPackageDefinition(packageDef) as unknown) as ProtoGrpcType
const randomPackage = grpcObj.randomPackage

function main() {
  const server = getServer()

  server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      console.error(err)
      return
    }
    console.log(`Your server as started on port ${port}`)
    server.start()
    setupPubSub()
  })
}


const messageStreamByUserId = new Map<number, grpc.ServerWritableStream<StreamRequest__Output, StreamMessage>>()
const userStreamByUserId = new Map<number, grpc.ServerWritableStream<StreamRequest__Output, UserStreamResponse>>()

function getServer() {
  const server = new grpc.Server()
  server.addService(randomPackage.ChatService.service, {
    ChatInitiate: (call, callback) => {
      const sessionName = (call.request.name || '').trim().toLowerCase();
      const avatar = call.request.avatarUrl || ''

      if (!sessionName || !avatar) return callback(new Error("Name or avatar required"))

      listUsers((err, users) => {
        if (err) return callback(err)

        const dbUser = users.find(u => u.name?.toLowerCase() === sessionName)
        if (!dbUser) {
          const user: User = {
            id: Math.floor(Math.random() * 10000),
            status: Status.ONLINE,
            name: sessionName,
            avatarUrl: avatar
          }
          addUser(user, (err) => {  
            if (err) return callback(err)
            emitUserUpdate(user)
            return callback(null, {id: user.id})
          })
        } else {
          if (dbUser.status === Status.ONLINE) {
            console.log("error here")
            return callback(new Error("User exist and is online"))
          }
  
          dbUser.status = Status.ONLINE 
          updateUser(dbUser, (err) => {
            if (err) return callback(err)
            emitUserUpdate(dbUser)
            return callback(null, {id: dbUser.id})
          })
        }
      })
    },

    SendMessage: (call, callback) => {
      const {id = -1, message = ''} = call.request
      if (!id || !message) return callback(new Error("IDK who u r"))

      getUser(id, (err, user) => {
        if (err) return callback(err)
        const msg: StreamMessage = {
          userId: user.id,
          message: message,
          userAvatar: user.avatarUrl,
          userName: user.name
        };
        addMessageToRoom(msg, (err) => {
          if(err) return callback(err)
          emitMainChatRoomUpdate(msg)
          callback(null)
        })
      });
    },

    ChatStream: (call) => {
      const {id = -1} = call.request
      if (!id) return call.end()
      getUser(id, (err, user) => {
        if (err) return call.end()
        listMessagesInRoom((err, msgs) => {
          if (err) call.end()
          for (const msg of msgs) {
            call.write(msg)
          }
          messageStreamByUserId.set(id, call)
        })
        call.on("cancelled", () => {
          user.status = Status.OFFLINE
          updateUser(user, (err) => {
            if (err) console.error(err)
            messageStreamByUserId.delete(id)
            emitUserUpdate(user)
          })
        })
      });
    },

    UserStream: (call) => {
      const {id = -1} = call.request
      if (!id) return call.end()
      getUser(id, (err) => {
        if (err) return call.end()
        listUsers((err, users) => {
          if (err) call.end()
            call.write({users})
          userStreamByUserId.set(id, call)
        })

        call.on("cancelled", () => {
            messageStreamByUserId.delete(id)
        })

      });
    }
  } as ChatServiceHandlers);

  return server;
}

const setupPubSub = () => {
  listenUserUpdate(() => {
    listUsers((err, users) => {
      if(err) return console.log(err)
      for (const [userId, userCall] of userStreamByUserId) {
        userCall.write({users})
      }
    })
  })

  listenMainChatRoomUpdate((msg, channel) => {
    console.log(channel)
    for (const [userId, userCall] of messageStreamByUserId) {
      userCall.write(msg)
    }
  })
}

main()