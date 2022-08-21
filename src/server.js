import http from "http";
import SocketIO from "socket.io";
import express from "express";

const app = express();

app.set("view engine", "pug"); // 템플릿 엔진 지정
app.set("views", __dirname + "/views"); // Express에 template이 어디 있는지 지정해준다.
app.use("/public", express.static(__dirname + "/public")); // 유저가 /public으로 가게되면 __dirname + "/public" 폴더를 보여준다.
// public url을 생성해서 유저에게 파일을 공유해준다.

app.get("/", (req, res) => res.render("home")); // 홈으로 이동하면 "home" 렌더링
// home.pug를 render 해주는 route handler
app.get("/*", (req, res) => res.redirect("/")); // 어떤 url로 들어오든 홈으로 보낸다.

const httpServer = http.createServer(app); // http 서버 생성
const wsServer = SocketIO(httpServer);

wsServer.on("connection", (socket) => {
  socket["nickname"] = "Anon";
  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit("welcome");
  });
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
  socket.on("new_message", (msg, room, done) => {
    socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
    done();
  });
  socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
});

const handleListen = () => console.log("Listening on http://localhost:3000");
httpServer.listen(3000, handleListen);
