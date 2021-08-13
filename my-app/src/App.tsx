import React, { useEffect, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import Greeting from './components/Greeting'
import Chat from './components/Chat'
import { InitiateRequest, User, Status, StreamRequest, StreamMessage, UserStreamResponse, MessageRequest} from './proto/random_pb'
import {ChatServiceClient} from './proto/RandomServiceClientPb'

const client = new ChatServiceClient("http://localhost:8080");

function App() {
  const [msgs, setMsgs] = useState<Array<StreamMessage.AsObject>>([])
  const [users, setUsers] = useState<Array<User.AsObject>>([])
  const [user, setUser] = useState<User.AsObject>();

  useEffect(() => {
    if (!user) return
    const req = new StreamRequest()
    req.setId(user.id)

    // for chat stream
    ;(() => {
      const stream = client.chatStream(req, {})
      stream.on("data", (chunk) => {
        const msg = (chunk as StreamMessage).toObject();
        setMsgs(prev => [...prev, msg])
      })
    }) ();

    // for user Stream
    ;(() => {
      const stream = client.userStream(req, {})
      stream.on("data", (chunk) => {
        const users = (chunk as UserStreamResponse).toObject().usersList;
        setUsers(users)
      })
    }) ();
  
  }, [user]);

  const handleUserSubmit = (name: string, avatar: string) => {
    console.log(name, avatar);
    if(!name || !avatar) return 
  
    const req = new InitiateRequest()
    req.setName(name);
    req.setAvatarUrl(avatar);
    client.chatInitiate(req, {}, (err, resp) => {
      if(err) return console.log(err)
      const respObj = resp.toObject();
      setUser({ id: respObj.id, name: name, avatarUrl: avatar, status: Status.ONLINE });
    })
  };

  const handleMessageSubmit = (msg: string, onSuccess: () => void) => {
    if(!user || !msg.trim()) return;
    const msgReq = new MessageRequest()
    msgReq.setId(user.id)
    msgReq.setMessage(msg)
    client.sendMessage(msgReq, {}, (err, resp) => {
      if (err) console.error(err);
      console.log(resp)
      onSuccess()
    })
  }

  return (
    <div className="App">
      <div className="App-container">
        {!user ? <Greeting onUsernameEnter={handleUserSubmit}/> : <Chat user={user} userList={users} messages={msgs} onMessageSubmit={handleMessageSubmit}/>}
      </div>
    </div>
  );
}

export default App;
