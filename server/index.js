require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const HTTP_PORT = process.env.PORT || 4000;

const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: '*' },
  reconnectionAttempts: 5,
});
const { init } = require('./utils/lib');

mongoose.set('strictQuery', false);
mongoose
  .connect(process.env.MongoDB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    init()
      .then((done) => {
        console.log('sorted the search');
      })
      .catch((error) => {
        console.log(error);
      });

    console.log(`connected to mongodb`);
  })
  .catch((e) => console.error(e));

const UserRouter = require('./controllers/userController');
const CodeRouter = require('./controllers/codeController');

// Socket Event Handlers
const JoinHandler = require('./sockets/join');
const SendMessageHandler = require('./sockets/sendMessage');
const EditMessageHandler = require('./sockets/editMessage');
const SeenMessageHandler = require('./sockets/seenMesage');
const DeleteMessageHandler = require('./sockets/deleteMessage');
const TypingHandler = require('./sockets/typing');
const LogOutHandler = require('./sockets/logout');
const CloseChatHandler = require('./sockets/close');
const stopSearch = require('./sockets/stopSearch');
const onlineStatus = require('./sockets/onlineStatus');
const requestPublicKeyHandler = require('./sockets/requestPublicKey');

app.use(express.json());
app.use(cors());
app.use(UserRouter);
app.use('/code', CodeRouter);

// In production the built client (vite build) is served from this same origin,
// so the browser's API and socket.io calls need no separate URL.
const CLIENT_DIST = process.env.CLIENT_DIST || path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback: any other GET returns index.html for react-router.
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

// triggers when a user is connected to a socket
io.on('connection', (socket) => {
  const chatId = socket.handshake.query.chatId;
  if (chatId) {
    socket.join(chatId);
  }
  /**
   * This event is emitted once the user clicks on the Start button or
   * navigates to the /founduser route
   */
  JoinHandler(io, socket);
  SendMessageHandler(socket);
  EditMessageHandler(socket);
  DeleteMessageHandler(socket);
  SeenMessageHandler(socket);
  TypingHandler(socket);
  LogOutHandler(io, socket);
  CloseChatHandler(socket);
  stopSearch(socket);
  onlineStatus(socket);
  requestPublicKeyHandler(io, socket);
});

server.listen(HTTP_PORT, async () => {
  console.log(`connected to port ${HTTP_PORT}`);
});
