// --- Firebase and Cloudinary Configuration ---
// WARNING: This is a hardcoded API key. In a production environment,
// this should be stored securely using environment variables or a secret management service.
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
const loginFormContainer = document.getElementById('login-form-container');
const signupFormContainer = document.getElementById('signup-form-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const googleSignInBtn = document.getElementById('google-signin');
const chatContainer = document.getElementById('chat-container');
const signOutBtn = document.getElementById('sign-out-menu');
const userProfilePic = document.getElementById('user-profile-pic');
const usersList = document.getElementById('users-list');
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
const videoGrid = document.getElementById('video-grid');
const localVideoContainer = document.getElementById('local-video-container');
const localVideo = document.getElementById('local-video');
const endCallBtn = document.getElementById('end-call-btn');

// --- Global State ---
let currentUser = null;
let currentChatId = null;
let currentChatPartner = null;
let currentChatMembers = {};
let unsubscribeMessages = null;
let allUsers = {};
let oneToOneCallListener = null;

// --- Call State ---
let localStream;
let isCallActive = false;
let oneToOneCallDocRef = null;
let groupCallConnections = {};
let groupCallListeners = [];
const configuration = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };

// --- Authentication & Initialization ---
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        await prefetchUsers();

        const userRef = db.collection('users').doc(user.uid);
        userRef.onSnapshot(doc => {
            let userData;
            if (doc.exists) {
                userData = doc.data();
            } else {
                userData = {
                    uid: user.uid,
                    displayName: user.displayName || 'New User',
                    photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'N A')}&background=random`,
                    email: user.email,
                    status: 'Hey there! I am using WhatsApp Clone.',
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                };
                userRef.set(userData);
            }
            currentUser.displayName = userData.displayName;
            currentUser.photoURL = userData.photoURL;
            currentUser.status = userData.status;
            allUsers[user.uid] = userData;
            updateProfileUI(currentUser);
        });

        loadChats();
        listenForIncomingOneToOneCalls(user.uid);
    } else {
        currentUser = null;
        authContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
        if (unsubscribeMessages) unsubscribeMessages();
        if (oneToOneCallListener) oneToOneCallListener();
        groupCallListeners.forEach(unsubscribe => unsubscribe());
        groupCallListeners = [];
    }
});

const provider = new firebase.auth.GoogleAuthProvider();
googleSignInBtn.onclick = () => auth.signInWithPopup(provider);
signOutBtn.onclick = () => auth.signOut();
showSignupBtn.onclick = e => { e.preventDefault(); loginFormContainer.style.display = 'none'; signupFormContainer.style.display = 'block'; };
showLoginBtn.onclick = e => { e.preventDefault(); signupFormContainer.style.display = 'none'; loginFormContainer.style.display = 'block'; };

signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = e.target['signup-name'].value;
    const email = e.target['signup-email'].value;
    const password = e.target['signup-password'].value;
    if (!name || !email || !password) return alert("All fields are required.");
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
    } catch (error) { console.error("Sign up error:", error); alert(error.message); }
});

loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = e.target['login-email'].value;
    const password = e.target['login-password'].value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) { console.error("Login error:", error); alert(error.message); }
});


// --- User & Profile Management ---
async function prefetchUsers() {
    const snapshot = await db.collection('users').get();
    snapshot.forEach(doc => allUsers[doc.id] = doc.data());
}

function updateProfileUI(user) {
    if (user.photoURL) {
        userProfilePic.src = user.photoURL;
        profilePictureDisplay.src = user.photoURL;
    }
    profileNameInput.value = user.displayName;
    profileStatusInput.value = user.status || '';
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
        await db.collection('chats').add({
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
            if (chat.isGroup) {
                chatListItems.push(createChatListItem(chat));
            } else {
                chat.members.forEach(m => usersWithChats.add(m));
                chatListItems.push(createChatListItem(chat));
            }
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
        videoCallBtn.style.display = 'block';
        videoCallBtn.onclick = () => joinGroupCall();
        listenForIncomingGroupCalls();
    } else {
        chatPic.src = chatData.partner.photoURL || 'https://via.placeholder.com/40';
        chatName.innerText = chatData.partner.displayName;
        videoCallBtn.style.display = 'block';
        videoCallBtn.onclick = () => startOneToOneCall();
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
        const senderName = (allUsers[msg.sender] || {}).displayName || '...';
        content += `<div class="sender-name" style="font-weight: bold; font-size: 0.8em; color: var(--primary-strong); margin-bottom: 4px;">${senderName}</div>`;
    }

    if (msg.type === 'image') {
        content += `<img src="${msg.url}" alt="Chat Image" class="chat-image" style="max-width:100%; border-radius: 6px;">`;
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
        await chatRef.set({ isGroup: false, members: [currentUser.uid, currentChatPartner.uid], lastActivity: timestamp });
    }
    await chatRef.collection('messages').add({ ...messageData, createdAt: timestamp });
    await chatRef.update({ lastActivity: timestamp, lastMessage: { text: messageData.type === 'image' ? '📷 Photo' : messageData.text, sender: messageData.sender }});
}

messageForm.addEventListener('submit', e => { e.preventDefault(); const text = messageInput.value.trim(); if (text) { messageInput.value = ''; sendMessage({ text: text, sender: currentUser.uid, type: 'text' }); } });
attachmentBtn.onclick = () => imageUploadInput.click();
imageUploadInput.onchange = async e => { const file = e.target.files[0]; if (!file || !currentChatId) return; const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); try { const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData }); const data = await res.json(); if (data.secure_url) sendMessage({ url: data.secure_url, sender: currentUser.uid, type: 'image' }); } catch (error) { console.error('Image Upload Error:', error); } };


// --- WebRTC Video Calling ---

// 1-on-1 Calls
function listenForIncomingOneToOneCalls(userId) {
    if (oneToOneCallListener) oneToOneCallListener();
    oneToOneCallListener = db.collection('oneToOneCalls').where('callee', '==', userId).where('status', '==', 'ringing')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added' && !isCallActive) {
                    const callData = change.doc.data();
                    const callerInfo = allUsers[callData.caller] || {};
                    if (confirm(`Incoming call from ${callerInfo.displayName}. Answer?`)) {
                        await answerOneToOneCall(change.doc.id, callData.offer);
                    } else {
                        await db.collection('oneToOneCalls').doc(change.doc.id).update({ status: 'rejected' });
                    }
                }
            });
        });
}

async function startOneToOneCall() {
    if (!currentChatPartner || currentChatPartner.isGroup) return;
    isCallActive = true;
    oneToOneCallDocRef = db.collection('oneToOneCalls').doc(currentChatId);
    groupCallConnections['peer'] = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners(groupCallConnections['peer'], 'peer');
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => groupCallConnections['peer'].addTrack(track, localStream));
    const offer = await groupCallConnections['peer'].createOffer();
    await groupCallConnections['peer'].setLocalDescription(offer);
    await oneToOneCallDocRef.set({ offer: { sdp: offer.sdp, type: offer.type }, caller: currentUser.uid, callee: currentChatPartner.uid, status: 'ringing' });
    videoContainer.style.display = 'flex';
    listenForOneToOneCallUpdates();
}

async function answerOneToOneCall(callId, offer) {
    isCallActive = true;
    oneToOneCallDocRef = db.collection('oneToOneCalls').doc(callId);
    groupCallConnections['peer'] = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners(groupCallConnections['peer'], 'peer');
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => groupCallConnections['peer'].addTrack(track, localStream));
    await groupCallConnections['peer'].setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await groupCallConnections['peer'].createAnswer();
    await groupCallConnections['peer'].setLocalDescription(answer);
    await oneToOneCallDocRef.update({ answer: { type: answer.type, sdp: answer.sdp }, status: 'connected' });
    videoContainer.style.display = 'flex';
    listenForOneToOneCallUpdates();
}

function listenForOneToOneCallUpdates() {
    const unsubscribe = oneToOneCallDocRef.onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!groupCallConnections['peer'].currentRemoteDescription && data?.answer) {
            await groupCallConnections['peer'].setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        if (data?.status === 'ended' || data?.status === 'rejected') hangUp();
    });
    groupCallListeners.push(unsubscribe);
}

// Group Calls
function listenForIncomingGroupCalls() {
    const callDocRef = db.collection('groupCalls').doc(currentChatId);
    const membersRef = callDocRef.collection('members');
    const unsubscribe = membersRef.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' && change.doc.id !== currentUser.uid && isCallActive) {
                connectToPeer(change.doc.id, false);
            }
            if (change.type === 'removed') {
                handlePeerDisconnect(change.doc.id);
            }
        });
    });
    groupCallListeners.push(unsubscribe);
}

async function joinGroupCall() {
    if (!currentChatId || !currentChatPartner.isGroup) return;
    isCallActive = true;
    videoContainer.style.display = 'flex';
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    const callDocRef = db.collection('groupCalls').doc(currentChatId);
    const memberRef = callDocRef.collection('members').doc(currentUser.uid);
    await memberRef.set({ name: currentUser.displayName, joinedAt: Date.now() });

    const otherMembersSnapshot = await callDocRef.collection('members').get();
    otherMembersSnapshot.forEach(doc => {
        if (doc.id !== currentUser.uid) {
            connectToPeer(doc.id, true);
        }
    });
}

function connectToPeer(peerUid, isInitiator) {
    const pc = new RTCPeerConnection(configuration);
    groupCallConnections[peerUid] = pc;
    registerPeerConnectionListeners(pc, peerUid, isInitiator);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

function registerPeerConnectionListeners(pc, peerUid, isInitiator = false) {
    pc.ontrack = event => handleRemoteTrack(event, peerUid);
    pc.onicecandidate = event => {
        if (event.candidate) {
            const ref = oneToOneCallDocRef ? oneToOneCallDocRef.collection(isInitiator ? 'callerCandidates' : 'calleeCandidates') : db.collection('groupCalls').doc(currentChatId).collection('members').doc(currentUser.uid).collection('signals').doc(peerUid).collection('iceCandidates');
            ref.add(event.candidate.toJSON());
        }
    };

    if (oneToOneCallDocRef) {
        const iceCandidatesRef = oneToOneCallDocRef.collection(isInitiator ? 'calleeCandidates' : 'callerCandidates');
        groupCallListeners.push(iceCandidatesRef.onSnapshot(snapshot => snapshot.docChanges().forEach(change => change.type === 'added' && pc.addIceCandidate(new RTCIceCandidate(change.doc.data())))));
    } else { // Group Call
        const signalsRef = db.collection('groupCalls').doc(currentChatId).collection('members').doc(peerUid).collection('signals').doc(currentUser.uid);
        groupCallListeners.push(signalsRef.collection('iceCandidates').onSnapshot(snapshot => snapshot.docChanges().forEach(change => change.type === 'added' && pc.addIceCandidate(new RTCIceCandidate(change.doc.data())))));

        if (isInitiator) {
            pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => signalsRef.set({ offer: pc.localDescription }));
        }
        groupCallListeners.push(signalsRef.onSnapshot(async doc => {
            if (doc.exists) {
                const data = doc.data();
                if (data.offer && !isInitiator) {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    signalsRef.set({ answer: pc.localDescription });
                }
                if (data.answer && isInitiator) {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            }
        }));
    }
}

function handleRemoteTrack(event, peerUid) {
    let videoContainerEl = document.getElementById(`video-${peerUid}`);
    if (!videoContainerEl) {
        videoContainerEl = document.createElement('div');
        videoContainerEl.id = `video-${peerUid}`;
        videoContainerEl.className = 'video-participant';
        const name = (allUsers[peerUid] || {}).displayName || 'Peer';
        videoContainerEl.innerHTML = `<video autoplay playsinline></video><div class="participant-name">${name}</div>`;
        videoGrid.appendChild(videoContainerEl);
    }
    videoContainerEl.querySelector('video').srcObject = event.streams[0];
}

function handlePeerDisconnect(peerUid) {
    if (groupCallConnections[peerUid]) {
        groupCallConnections[peerUid].close();
        delete groupCallConnections[peerUid];
    }
    const videoContainerEl = document.getElementById(`video-${peerUid}`);
    if (videoContainerEl) videoContainerEl.remove();
}

async function hangUp() {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    Object.values(groupCallConnections).forEach(pc => pc.close());
    groupCallConnections = {};

    if (isCallActive && currentChatPartner.isGroup) {
        const memberRef = db.collection('groupCalls').doc(currentChatId).collection('members').doc(currentUser.uid);
        await memberRef.delete().catch(() => {});
    }

    if (oneToOneCallDocRef) {
        const callData = (await oneToOneCallDocRef.get()).data();
        if(callData && callData.status !== 'ended') await oneToOneCallDocRef.update({ status: 'ended' });
        oneToOneCallDocRef = null;
    }

    groupCallListeners.forEach(unsubscribe => unsubscribe());
    groupCallListeners = [];
    videoGrid.innerHTML = '';
    videoGrid.appendChild(localVideoContainer);
    videoContainer.style.display = 'none';
    isCallActive = false;
}

endCallBtn.onclick = hangUp;
console.log("WhatsApp Clone script loaded.");