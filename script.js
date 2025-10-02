// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyDJCr4z7qwvCxP-t50wHTtMxB95T3S7_SY",
    authDomain: "safe-46480.firebaseapp.com",
    databaseURL: "https://safe-46480-default-rtdb.firebaseio.com",
    projectId: "safe-46480",
    storageBucket: "safe-46480.firebasestorage.app",
    messagingSenderId: "612208138762",
    appId: "1:612208138762:web:b53f1d26b7f9322c94ddf3"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM Elements ---
const authContainer = document.getElementById('auth-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const chatContainer = document.getElementById('chat-container');
const logoutBtn = document.getElementById('logout-btn');
const sidebarTabs = document.getElementById('sidebar-tabs');
const groupList = document.getElementById('group-list');
const userList = document.getElementById('user-list');
const createGroupForm = document.getElementById('create-group-form');
const currentChatName = document.getElementById('current-chat-name');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const welcomeScreen = document.querySelector('.welcome-screen');
const audioCallBtn = document.getElementById('audio-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const videoCallModal = document.getElementById('video-call-modal');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const hangupBtn = document.getElementById('hangup-btn');
const incomingCallModal = document.getElementById('incoming-call-modal');
const callerNameSpan = document.getElementById('caller-name');
const acceptCallBtn = document.getElementById('accept-call-btn');
const declineCallBtn = document.getElementById('decline-call-btn');

// --- State ---
let currentUser = null;
let currentChat = { id: null, type: null, name: '' };
let unsubscribeMessages = null;
let unsubscribeCallDoc = null;
let currentCall = { id: null, from: null, fromName: '', type: '' };

// WebRTC State
const servers = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };
let pc;
let localStream;
let remoteStream;

// --- Auth & Basic UI (unchanged) ---
auth.onAuthStateChanged(user => { if (user) { currentUser = user; authContainer.style.display = 'none'; chatContainer.style.display = 'flex'; setupUserData(user); loadGroups(); loadUsers(); listenForIncomingCalls(); } else { currentUser = null; authContainer.style.display = 'block'; chatContainer.style.display = 'none'; resetChatState(); if (unsubscribeCallDoc) unsubscribeCallDoc(); } });
async function setupUserData(user) { const userRef = db.collection('users').doc(user.uid); const doc = await userRef.get(); if (!doc.exists) { const name = user.email.split('@')[0]; await user.updateProfile({ displayName: name }); await userRef.set({ uid: user.uid, displayName: name, email: user.email, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); } }
loginForm.addEventListener('submit', (e) => { e.preventDefault(); auth.signInWithEmailAndPassword(e.target['login-email'].value, e.target['login-password'].value).catch(err => alert(err.message)); });
signupForm.addEventListener('submit', (e) => { e.preventDefault(); auth.createUserWithEmailAndPassword(e.target['signup-email'].value, e.target['signup-password'].value).catch(err => alert(err.message)); });
logoutBtn.addEventListener('click', () => auth.signOut());
document.getElementById('toggle-to-signup').addEventListener('click', () => { loginForm.style.display = 'none'; signupForm.style.display = 'block'; });
document.getElementById('toggle-to-login').addEventListener('click', () => { loginForm.style.display = 'block'; signupForm.style.display = 'none'; });
function resetChatState() { currentChat = { id: null, type: null, name: '' }; if (unsubscribeMessages) unsubscribeMessages(); welcomeScreen.style.display = 'flex'; messageForm.classList.add('hidden'); audioCallBtn.classList.add('hidden'); videoCallBtn.classList.add('hidden'); currentChatName.textContent = 'Select a Chat'; }
function setActiveChatUI(name, type) { currentChatName.textContent = name; welcomeScreen.style.display = 'none'; messageForm.classList.remove('hidden'); messagesDiv.innerHTML = ''; if (type === 'direct') { audioCallBtn.classList.remove('hidden'); videoCallBtn.classList.remove('hidden'); } else { audioCallBtn.classList.add('hidden'); videoCallBtn.classList.add('hidden'); } }
sidebarTabs.addEventListener('click', (e) => { if (e.target.classList.contains('tab-btn')) { const tabName = e.target.dataset.tab; document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active')); document.getElementById(`${tabName}-content`).classList.add('active'); } });
createGroupForm.addEventListener('submit', (e) => { e.preventDefault(); const groupName = createGroupForm['group-name-input'].value; if (groupName.trim() === '') return; db.collection('groups').add({ name: groupName, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser.uid, members: [currentUser.uid] }).then(() => createGroupForm.reset()).catch(err => console.error("Error creating group: ", err)); });
function loadGroups() { db.collection('groups').orderBy('createdAt', 'desc').onSnapshot(snapshot => { if (snapshot.empty) { groupList.innerHTML = '<li class="empty-list-item">No groups yet.</li>'; return; } groupList.innerHTML = ''; snapshot.forEach(doc => { const group = doc.data(); const li = document.createElement('li'); li.textContent = group.name; li.setAttribute('data-id', doc.id); if (doc.id === currentChat.id) li.classList.add('active'); li.addEventListener('click', () => selectChat(doc.id, 'group', group.name, li)); groupList.appendChild(li); }); }); }
function loadUsers() { db.collection('users').orderBy('displayName').onSnapshot(snapshot => { if (snapshot.empty) { userList.innerHTML = '<li class="empty-list-item">No other users found.</li>'; return; } userList.innerHTML = ''; snapshot.forEach(doc => { const user = doc.data(); if (user.uid === currentUser.uid) return; const li = document.createElement('li'); li.setAttribute('data-id', user.uid); li.innerHTML = `<div class="user-avatar" style="background-color: #${user.uid.slice(0, 6)}">${user.displayName.charAt(0).toUpperCase()}</div><span class="user-name">${user.displayName}</span>`; if (user.uid === currentChat.id) li.classList.add('active'); li.addEventListener('click', () => selectChat(user.uid, 'direct', user.displayName, li)); userList.appendChild(li); }); }); }
function selectChat(id, type, name, element) { if (currentChat.id === id) return; currentChat = { id, type, name }; document.querySelectorAll('#group-list li, #user-list li').forEach(item => item.classList.remove('active')); element.classList.add('active'); setActiveChatUI(name, type); loadMessages(); }
function loadMessages() { if (unsubscribeMessages) unsubscribeMessages(); let chatRef; if (currentChat.type === 'group') { chatRef = db.collection('groups').doc(currentChat.id).collection('messages'); } else { const chatId = [currentUser.uid, currentChat.id].sort().join('_'); chatRef = db.collection('direct_chats').doc(chatId).collection('messages'); } unsubscribeMessages = chatRef.orderBy('createdAt').onSnapshot(snapshot => { snapshot.docChanges().forEach(change => { if (change.type === "added") messagesDiv.appendChild(createMessageElement(change.doc.id, change.doc.data())); if (change.type === "modified") { const messageEl = document.getElementById(`message-${change.doc.id}`); if (messageEl) { const timestampEl = messageEl.querySelector('.timestamp'); if (timestampEl) timestampEl.textContent = formatTimestamp(change.doc.data().createdAt); } } }); messagesDiv.scrollTop = messagesDiv.scrollHeight; }, err => console.error("Error listening to messages:", err)); }
messageForm.addEventListener('submit', (e) => { e.preventDefault(); const text = messageInput.value; if (text.trim() === '' || !currentChat.id) return; let chatRef; if (currentChat.type === 'group') { chatRef = db.collection('groups').doc(currentChat.id).collection('messages'); } else { const chatId = [currentUser.uid, currentChat.id].sort().join('_'); chatRef = db.collection('direct_chats').doc(chatId).collection('messages'); } chatRef.add({ text: text, senderId: currentUser.uid, senderName: currentUser.displayName, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(() => messageInput.value = '').catch(err => console.error("Error sending message: ", err)); });
function createMessageElement(docId, message) { const messageEl = document.createElement('div'); messageEl.classList.add('message'); messageEl.id = `message-${docId}`; messageEl.classList.add(message.senderId === currentUser.uid ? 'sent' : 'received'); const senderName = message.senderName || 'Anonymous'; const messageTime = formatTimestamp(message.createdAt); const showSenderName = currentChat.type === 'group' && message.senderId !== currentUser.uid; messageEl.innerHTML = `<div class="message-content"> ${showSenderName ? `<div class="sender-name">${senderName}</div>` : ''} <div class="text">${message.text}</div> <div class="timestamp">${messageTime}</div> </div>`; return messageEl; }
function formatTimestamp(timestamp) { if (!timestamp) return ''; const date = timestamp.toDate(); let hours = date.getHours(); let minutes = date.getMinutes(); const ampm = hours >= 12 ? 'PM' : 'AM'; hours = hours % 12; hours = hours ? hours : 12; minutes = minutes < 10 ? '0' + minutes : minutes; return `${hours}:${minutes} ${ampm}`; }


// --- WebRTC Core Logic ---
async function startCall(callType) {
    if (!currentChat.id || currentChat.type !== 'direct') return alert("Please select a user to start a call.");

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true });
        localVideo.srcObject = localStream;
    } catch (error) { console.error("Error accessing media devices.", error); return; }

    videoCallModal.classList.remove('hidden');

    const callDocRef = db.collection('calls').doc();
    const offerCandidates = callDocRef.collection('offerCandidates');
    const answerCandidates = callDocRef.collection('answerCandidates');

    currentCall.id = callDocRef.id;
    pc = new RTCPeerConnection(servers);
    remoteStream = new MediaStream();

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        remoteVideo.srcObject = remoteStream;
    };

    pc.onicecandidate = event => {
        event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
    await callDocRef.set({ from: currentUser.uid, to: currentChat.id, fromName: currentUser.displayName, offer, type: callType });

    // Listen for changes to the call document
    unsubscribeCallDoc = callDocRef.onSnapshot(snapshot => {
        if (!snapshot.exists) {
            // This can be triggered by the other user hanging up.
            resetCallState();
            return;
        }
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    });

    answerCandidates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        });
    });
}

function listenForIncomingCalls() {
    db.collection('calls').where('to', '==', currentUser.uid)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added' && !change.doc.data().answer) {
                const callData = change.doc.data();
                currentCall = { id: change.doc.id, from: callData.from, fromName: callData.fromName, offer: callData.offer, type: callData.type };
                callerNameSpan.innerHTML = `<strong>${currentCall.fromName}</strong> is starting a ${currentCall.type} call...`;
                incomingCallModal.classList.remove('hidden');
            }
        });
    });
}

async function handleAcceptCall() {
    incomingCallModal.classList.add('hidden');

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: currentCall.type === 'video', audio: true });
        localVideo.srcObject = localStream;
    } catch (error) { console.error("Error accessing media devices.", error); return; }

    videoCallModal.classList.remove('hidden');

    const callDocRef = db.collection('calls').doc(currentCall.id);
    const offerCandidates = callDocRef.collection('offerCandidates');
    const answerCandidates = callDocRef.collection('answerCandidates');

    pc = new RTCPeerConnection(servers);
    remoteStream = new MediaStream();

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        remoteVideo.srcObject = remoteStream;
    };

    pc.onicecandidate = event => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    await pc.setRemoteDescription(new RTCSessionDescription(currentCall.offer));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
    await callDocRef.update({ answer });

    // Listen for changes to the call document (e.g., if the caller hangs up)
    unsubscribeCallDoc = callDocRef.onSnapshot(snapshot => {
        if (!snapshot.exists) {
            resetCallState();
        }
    });

    offerCandidates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        });
    });
}

async function handleDeclineCall() {
    incomingCallModal.classList.add('hidden');
    if (currentCall.id) {
        await db.collection('calls').doc(currentCall.id).update({ declined: true });
    }
    resetCallState();
}

async function handleHangup() {
    if (currentCall.id) {
        const callDocRef = db.collection('calls').doc(currentCall.id);
        const callDoc = await callDocRef.get();
        if (callDoc.exists) {
            // Delete subcollections first
            const offerCandidates = callDocRef.collection('offerCandidates');
            const answerCandidates = callDocRef.collection('answerCandidates');
            (await offerCandidates.get()).forEach(async doc => await doc.ref.delete());
            (await answerCandidates.get()).forEach(async doc => await doc.ref.delete());
            // Delete the main call document
            await callDocRef.delete();
        }
    }
    resetCallState();
}

function resetCallState() {
    videoCallModal.classList.add('hidden');
    if (pc) {
        pc.close();
        pc = null;
    }
    if (unsubscribeCallDoc) {
        unsubscribeCallDoc();
        unsubscribeCallDoc = null;
    }
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    localStream = null;
    remoteStream = null;
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    currentCall = { id: null, from: null, fromName: '', type: '' };
    micBtn.classList.add('active');
    camBtn.classList.add('active');
    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    camBtn.innerHTML = '<i class="fas fa-video"></i>';
}

// Call Control Event Listeners
micBtn.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        micBtn.classList.toggle('active', audioTrack.enabled);
        micBtn.innerHTML = audioTrack.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    }
});
camBtn.addEventListener('click', () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        camBtn.classList.toggle('active', videoTrack.enabled);
        camBtn.innerHTML = videoTrack.enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    }
});

// Main Event Listeners
videoCallBtn.addEventListener('click', () => startCall('video'));
audioCallBtn.addEventListener('click', () => startCall('audio'));
acceptCallBtn.addEventListener('click', handleAcceptCall);
declineCallBtn.addEventListener('click', handleDeclineCall);
hangupBtn.addEventListener('click', handleHangup);