// --- Firebase and Cloudinary Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDJCr4z7qwvCxP-t50wHTtMxB95T3S7_SY",
    authDomain: "safe-46480.firebaseapp.com",
    databaseURL: "https://safe-46480-default-rtdb.firebaseio.com",
    projectId: "safe-46480",
    storageBucket: "safe-46480.appspot.com",
    messagingSenderId: "612208138762",
    appId: "1:612208138762:web:b53f1d26b7f9322c94ddf3"
};
const CLOUDINARY_CLOUD_NAME = "dbe3ofhle";
const CLOUDINARY_UPLOAD_PRESET = "dlmwr7r1";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// --- Firebase Initialization ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM Element Variables ---
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const signOutBtn = document.getElementById('sign-out-menu');
const userProfilePic = document.getElementById('user-profile-pic');
const usersList = document.getElementById('users-list');
const rightPanel = document.getElementById('right-panel');
const chatHeader = document.getElementById('chat-header');
const chatPic = document.getElementById('chat-pic');
const chatName = document.getElementById('chat-name');
const welcomeScreen = document.getElementById('welcome-screen');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const attachmentBtn = document.getElementById('attachment-btn');
const imageUploadInput = document.getElementById('image-upload');
const videoCallBtn = document.getElementById('video-call-btn');
const profileModal = document.getElementById('profile-modal');
const closeProfileBtn = document.getElementById('close-profile-btn');
const profilePictureDisplay = document.getElementById('profile-picture-display');
const uploadPictureLabel = document.getElementById('upload-picture-label');
const uploadPictureInput = document.getElementById('upload-picture-input');
const profileNameInput = document.getElementById('profile-name-input');
const profileStatusInput = document.getElementById('profile-status-input');
const saveProfileBtn = document.getElementById('save-profile-btn');
const newGroupBtn = document.getElementById('new-group-btn');
const newGroupModal = document.getElementById('new-group-modal');
const closeGroupModalBtn = document.getElementById('close-group-modal-btn');
const groupNameInput = document.getElementById('group-name-input');
const groupMembersList = document.getElementById('group-members-list');
const createGroupBtn = document.getElementById('create-group-btn');
const videoContainer = document.getElementById('video-container');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const endCallBtn = document.getElementById('end-call-btn');

// --- Global State ---
let currentUser = null;
let currentChatId = null;
let currentChatPartner = null; // Can be a user object or a group object
let currentChatMembers = {}; // Cache for group member data
let unsubscribeMessages = null;
let unsubscribeCalls = null;
let allUsers = {}; // Cache for all user data

// WebRTC State
let pc;
let localStream;
let makingCall = false;
let callDocRef = null;
let unsubscribeCallDoc = null;
let unsubscribeCalleeCandidates = null;
let unsubscribeCallerCandidates = null;
const configuration = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };

// --- Authentication ---
const provider = new firebase.auth.GoogleAuthProvider();
document.getElementById('google-signin').onclick = () => auth.signInWithPopup(provider);
signOutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';

        await prefetchUsers(); // Fetch all user data at startup

        const userRef = db.collection('users').doc(user.uid);
        userRef.onSnapshot(doc => {
            if (doc.exists) {
                const userData = doc.data();
                currentUser.displayName = userData.displayName;
                currentUser.photoURL = userData.photoURL;
                currentUser.status = userData.status || 'Hey there! I am using WhatsApp.';
                updateProfileUI(currentUser);
            } else {
                const newUser = {
                    uid: user.uid, displayName: user.displayName, photoURL: user.photoURL,
                    email: user.email, status: 'Hey there! I am using WhatsApp.',
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                };
                userRef.set(newUser).then(() => updateProfileUI(newUser));
            }
        });

        loadChats();
        setupIncomingCallListener(user.uid);
    } else {
        currentUser = null;
        authContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeCalls) unsubscribeCalls();
        if (unsubscribeCallDoc) unsubscribeCallDoc();
    }
});

function updateProfileUI(user) {
    if (user.photoURL) {
        userProfilePic.src = user.photoURL;
        profilePictureDisplay.src = user.photoURL;
    }
    profileNameInput.value = user.displayName;
    profileStatusInput.value = user.status || '';
}

// --- User & Profile Management ---
async function prefetchUsers() {
    const snapshot = await db.collection('users').get();
    snapshot.forEach(doc => allUsers[doc.id] = doc.data());
}

userProfilePic.onclick = () => profileModal.style.display = 'flex';
closeProfileBtn.onclick = () => profileModal.style.display = 'none';
uploadPictureLabel.onclick = () => uploadPictureInput.click();

uploadPictureInput.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    try {
        const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) profilePictureDisplay.src = data.secure_url;
    } catch (error) { console.error('Upload Error:', error); alert('Image upload failed.'); }
};

saveProfileBtn.onclick = async () => {
    const userRef = db.collection('users').doc(currentUser.uid);
    try {
        await userRef.update({
            displayName: profileNameInput.value.trim(),
            status: profileStatusInput.value.trim(),
            photoURL: profilePictureDisplay.src
        });
        profileModal.style.display = 'none';
        alert('Profile saved!');
    } catch (error) { console.error('Profile Save Error:', error); alert('Failed to save profile.'); }
};

// --- Group Chat ---
newGroupBtn.onclick = () => {
    populateGroupMembers();
    newGroupModal.style.display = 'flex';
};
closeGroupModalBtn.onclick = () => newGroupModal.style.display = 'none';

function populateGroupMembers() {
    groupMembersList.innerHTML = '';
    Object.values(allUsers).forEach(user => {
        if (user.uid !== currentUser.uid) {
            const item = document.createElement('div');
            item.className = 'group-member-item';
            item.innerHTML = `<input type="checkbox" data-uid="${user.uid}" id="member-${user.uid}"><label for="member-${user.uid}"><img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="${user.displayName}"><span>${user.displayName}</span></label>`;
            groupMembersList.appendChild(item);
        }
    });
}

createGroupBtn.onclick = async () => {
    const groupName = groupNameInput.value.trim();
    if (!groupName) return alert('Please enter a group name.');
    const selectedMembers = Array.from(groupMembersList.querySelectorAll('input:checked')).map(i => i.dataset.uid);
    if (selectedMembers.length === 0) return alert('Please select at least one member.');

    try {
        const groupRef = await db.collection('chats').add({
            groupName: groupName,
            members: [currentUser.uid, ...selectedMembers],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
            isGroup: true,
            groupPhotoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=075e54&color=fff`,
            lastMessage: { text: 'Group created', sender: 'system' }
        });
        newGroupModal.style.display = 'none';
        alert('Group created successfully!');
    } catch (error) { console.error("Group Creation Error:", error); }
};

// --- Chat List & Messaging ---
function loadChats() {
    db.collection('chats').where('members', 'array-contains', currentUser.uid).orderBy('lastActivity', 'desc')
      .onSnapshot(snapshot => {
        const chatListItems = [];
        const usersWithChats = new Set([currentUser.uid]);

        snapshot.docs.forEach(doc => {
            const chat = { id: doc.id, ...doc.data() };
            if (!chat.isGroup) chat.members.forEach(m => usersWithChats.add(m));
            chatListItems.push(createChatListItem(chat));
        });

        Object.values(allUsers).forEach(user => {
            if (!usersWithChats.has(user.uid)) {
                chatListItems.push(createChatListItem({ partner: user, isNew: true }));
            }
        });

        usersList.innerHTML = '';
        chatListItems.forEach(item => { if (item) usersList.appendChild(item); });
    });
}

function createChatListItem(chat) {
    const chatElement = document.createElement('div');
    chatElement.className = 'user-chat-item';
    let photo, name, subtext, id;

    if (chat.isGroup) {
        id = chat.id;
        photo = chat.groupPhotoURL;
        name = chat.groupName;
        subtext = chat.lastMessage?.text || `${chat.members.length} members`;
    } else {
        const partner = chat.partner || allUsers[chat.members?.find(uid => uid !== currentUser.uid)];
        if (!partner) return null;
        id = chat.id || [currentUser.uid, partner.uid].sort().join('_');
        photo = partner.photoURL || 'https://via.placeholder.com/50';
        name = partner.displayName;
        subtext = chat.isNew ? (partner.status || 'Click to chat') : (chat.lastMessage?.text || '');
    }

    chatElement.setAttribute('data-chat-id', id);
    chatElement.innerHTML = `<img src="${photo}" alt="${name}"><div class="user-chat-info"><div class="name">${name}</div><div class="last-message">${subtext}</div></div>`;
    chatElement.onclick = () => startChat(chat.isGroup ? chat : { partner, id, isGroup: false });
    return chatElement;
}

async function startChat(chatData) {
    currentChatId = chatData.id;
    currentChatPartner = chatData.isGroup ? chatData : chatData.partner;
    currentChatMembers = {};

    welcomeScreen.style.display = 'none';
    chatHeader.classList.remove('hidden');
    messageForm.classList.remove('hidden');

    if (chatData.isGroup) {
        chatPic.src = chatData.groupPhotoURL;
        chatName.innerText = chatData.groupName;
        videoCallBtn.style.display = 'none';
        for (const memberId of chatData.members) {
            currentChatMembers[memberId] = allUsers[memberId] || (await db.collection('users').doc(memberId).get()).data();
        }
    } else {
        chatPic.src = chatData.partner.photoURL || 'https://via.placeholder.com/40';
        chatName.innerText = chatData.partner.displayName;
        videoCallBtn.style.display = 'block';
    }

    document.querySelectorAll('.user-chat-item.active').forEach(el => el.classList.remove('active'));
    document.querySelector(`.user-chat-item[data-chat-id='${currentChatId}']`)?.classList.add('active');

    loadMessages();
}

function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const messagesRef = db.collection('chats').doc(currentChatId).collection('messages').orderBy('createdAt');
    unsubscribeMessages = messagesRef.onSnapshot(snapshot => {
        messagesDiv.innerHTML = '';
        snapshot.forEach(doc => displayMessage(doc.data()));
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

function displayMessage(msg) {
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    const isSent = msg.sender === currentUser.uid;
    bubble.classList.add(isSent ? 'sent' : 'received');

    let content = '';
    if (currentChatPartner.isGroup && !isSent && msg.sender !== 'system') {
        const senderName = (currentChatMembers[msg.sender] || {}).displayName || '...';
        content += `<div class="sender-name" style="font-weight: bold; font-size: 0.8em; color: var(--primary-strong); margin-bottom: 4px;">${senderName}</div>`;
    }

    if (msg.type === 'image') {
        content += `<img src="${msg.url}" alt="Chat Image" class="chat-image">`;
    } else if (msg.type === 'system') {
        bubble.style.cssText = 'align-self: center; background-color: #e1f2fb; color: #5a7789; font-size: 0.85em;';
        content = msg.text;
    } else {
        content += msg.text;
    }

    bubble.innerHTML = content;
    messagesDiv.appendChild(bubble);
}

async function sendMessage(messageData) {
    if (!currentChatId) return;
    const chatRef = db.collection('chats').doc(currentChatId);
    const doc = await chatRef.get();
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();

    if (!doc.exists) {
        await chatRef.set({ isGroup: false, members: [currentUser.uid, currentChatPartner.uid] });
    }
    await chatRef.collection('messages').add({ ...messageData, createdAt: timestamp });
    await chatRef.update({ lastActivity: timestamp, lastMessage: { text: messageData.type === 'image' ? '📷 Photo' : messageData.text, sender: messageData.sender }});
}

messageForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text) {
        messageInput.value = '';
        sendMessage({ text: text, sender: currentUser.uid, type: 'text' });
    }
});

attachmentBtn.onclick = () => imageUploadInput.click();
imageUploadInput.onchange = async e => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    try {
        const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) sendMessage({ url: data.secure_url, sender: currentUser.uid, type: 'image' });
    } catch (error) { console.error('Image Upload Error:', error); }
};

// --- WebRTC Video Calling ---
function setupIncomingCallListener(userId) {
    if (unsubscribeCalls) unsubscribeCalls();
    unsubscribeCalls = db.collection('calls').where('callee', '==', userId).where('status', '==', 'ringing')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    if (videoContainer.style.display === 'flex') return;
                    const callData = change.doc.data();
                    const callerInfo = allUsers[callData.caller] || (await db.collection('users').doc(callData.caller).get()).data();
                    if (confirm(`Incoming call from ${callerInfo.displayName}. Answer?`)) {
                        await answerCall(change.doc.id, callData.offer);
                    } else {
                        await change.doc.ref.update({ status: 'rejected' });
                    }
                }
            });
        });
}

videoCallBtn.onclick = async () => {
    if (!currentChatPartner || currentChatPartner.isGroup) return;
    makingCall = true;
    callDocRef = db.collection('calls').doc(currentChatId);
    pc = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await callDocRef.set({ offer: { sdp: offer.sdp, type: offer.type }, caller: currentUser.uid, callee: currentChatPartner.uid, status: 'ringing' });
    videoContainer.style.display = 'flex';
    listenForCallUpdates();
};

async function answerCall(callId, offer) {
    callDocRef = db.collection('calls').doc(callId);
    pc = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await callDocRef.update({ answer: { type: answer.type, sdp: answer.sdp }, status: 'connected' });
    videoContainer.style.display = 'flex';
    listenForCallUpdates();
}

function listenForCallUpdates() {
    unsubscribeCallDoc = callDocRef.onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer && !makingCall) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        if (data?.status === 'ended' || data?.status === 'rejected') hangUp();
    });
    const candidatesCollection = makingCall ? callDocRef.collection('calleeCandidates') : callDocRef.collection('callerCandidates');
    unsubscribeCalleeCandidates = candidatesCollection.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        });
    });
}

function registerPeerConnectionListeners() {
    pc.onicecandidate = e => e.candidate && (makingCall ? callDocRef.collection('callerCandidates') : callDocRef.collection('calleeCandidates')).add(e.candidate.toJSON());
    pc.ontrack = e => remoteVideo.srcObject = e.streams[0];
    pc.onconnectionstatechange = () => (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' || pc.connectionState === 'failed') && hangUp();
}

async function hangUp() {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (pc) { pc.close(); pc = null; }
    if (callDocRef) {
        const callData = (await callDocRef.get()).data();
        if(callData && callData.status !== 'ended') await callDocRef.update({ status: 'ended' });
    }
    if (unsubscribeCallDoc) unsubscribeCallDoc();
    if (unsubscribeCalleeCandidates) unsubscribeCalleeCandidates();
    if (unsubscribeCallerCandidates) unsubscribeCallerCandidates();
    videoContainer.style.display = 'none';
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    makingCall = false;
    callDocRef = null;
}

endCallBtn.onclick = hangUp;

console.log("WhatsApp Clone script loaded.");