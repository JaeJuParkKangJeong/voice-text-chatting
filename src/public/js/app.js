const socket = io();

const muteBtn = document.getElementById("mute");
const micsSelect = document.getElementById("mics");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let roomName;
let myPeerConnection;
let myDataChannel;

// 마이크 목록 불러오기
async function getMics() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((device) => device.kind === "audioinput");
    const currentMic = myStream.getAudioTracks()[0];
    mics.forEach((mic) => {
      const option = document.createElement("option");
      option.value = mic.deviceId;
      option.innerText = mic.label;
      if (currentMic.label === mic.label) {
        // stream의 오디오와 paint할 때의 오디오 option을 가져와서 비교 후, stream의 오디오를 paint 하도록 한다.
        option.selected = true;
      }
      micsSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: false, // false로 놓음으로써 카메라 사용 X
  };
  const micsConstraints = {
    audio: { deviceId: { exact: deviceId } },
    video: false,
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? micsConstraints : initialConstraints
    );
    myVoice.srcObject = myStream;
    if (!deviceId) {
      await getMics();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}

// function handleCameraClick() {
//   myStream
//     .getVideoTracks()
//     .forEach((track) => (track.enabled = !track.enabled));
//   if (cameraOff) {
//     cameraBtn.innerText = "Turn Camera Off";
//     cameraOff = false;
//   } else {
//     cameraBtn.innerText = "Turn Camera On";
//     cameraOff = true;
//   }
// }

function handleMicChange() {
  getMedia(micsSelect.value); // 이 코드를 통해 mic의 stream이 변경됐음.
  if (myPeerConnection) {
    const audioTrack = myStream.getAudioTracks()[0];
    const audioSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "audio");
    audioSender.replaceTrack(audioTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
// cameraBtn.addEventListener("click", handleCameraClick);
micsSelect.addEventListener("input", handleMicChange);

// Welcome Form (join a room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

/**
 * Socket Code
 * P2P 연결
 */

// peerB가 들어왔다는 알림을 받는 peerA에서 실행
socket.on("welcome", async () => {
  myDataChannel = myPeerConnection.createDataChannel("chat"); // 채널 이름 : chat
  myDataChannel.addEventListener("meesage", console.log);
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

// peerA의 offer를 받게 되는 peerB에서 실행
socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", console.log); // data를 받아서 바로 console.log
  });
  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

// peerB의 answer를 받는 peerA에서 실행
socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("received candidate");
  myPeerConnection.addIceCandidate(ice);
});

/**
 * 채팅
 */

const chat = document.getElementById("chat");
const msgForm = chat.querySelector("#msg");
const nameForm = chat.querySelector("#name");

socket.on("new_message", addMessage);

//html에 메시지 출력
function addMessage(message) {
  const ul = chat.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = message;
  ul.appendChild(li);
}

// 메시지 전송
function handleMessageSubmit(event) {
  event.preventDefault();
  const input = chat.querySelector("#msg input");
  const value = input.value;
  myDataChannel.send(value);
  socket.emit("new_message", input.value, roomName, () => {
    addMessage(`You: ${value}`);
  });
  input.value = "";
}

// 닉네임 설정
function handleNicknameSubmit(event) {
  event.preventDefault();
  const input = chat.querySelector("#name input");
  socket.emit("nickname", input.value);
  input.value = "";
}

msgForm.addEventListener("submit", handleMessageSubmit);
nameForm.addEventListener("submit", handleNicknameSubmit);

/**
 * RTC Code
 */

function makeConnection() {
  myPeerConnection = new RTCPeerConnection();
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getAudioTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  const peerVoice = document.getElementById("peerVoice");
  peerVoice.srcObject = data.stream; // 상대 브라우저의 stream 정보(data.stream)를 home.pug의 video#peerFace에 넣어준다.
}
