// ---------- Firebase & Config ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Firebase config from generated file
const firebaseConfig = window.firebaseConfig;
if (!firebaseConfig) {
  console.error('Firebase config not loaded. Check firebase-config.js');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ---------- Set persistence (stay logged in) ----------
setPersistence(auth, browserLocalPersistence).catch(console.error);


// ---------- Models List (same as before) ----------
const models = [
  { name: "claud-3-opuss", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fhumain-icon-sm.22d2dc92.jpg&w=64&q=75", provider: "Humain" },
  { name: "DeepSeek-R1-0528", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fqwen-icon-sm.b6542287.png&w=64&q=75", provider: "DeepSeek" },
  { name: "DeepSeek-R1-Distill-Llama-70B", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fqwen-icon-sm.b6542287.png&w=64&q=75", provider: "DeepSeek" },
  { name: "DeepSeek-V3-0324", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fqwen-icon-sm.b6542287.png&w=64&q=75", provider: "DeepSeek" },
  { name: "DeepSeek-V3.1", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fqwen-icon-sm.b6542287.png&w=64&q=75", provider: "DeepSeek" },
  { name: "DeepSeek-V3.1-Terminus", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fqwen-icon-sm.b6542287.png&w=64&q=75", provider: "DeepSeek" },
  { name: "DeepSeek-V3.1-cb", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fqwen-icon-sm.b6542287.png&w=64&q=75", provider: "DeepSeek" },
  { name: "DeepSeek-V3.2", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fqwen-icon-sm.b6542287.png&w=64&q=75", provider: "DeepSeek" },
  { name: "E5-Mistral-7B-Instruct", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fmistral-sm.73a57155.png&w=64&q=75", provider: "Mistral" },
  { name: "Llama-3.3-Swallow-70B-Instruct-v0.4", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fmeta-icon-sm.c7b70d98.png&w=64&q=75", provider: "Meta" },
  { name: "Llama-4-Maverick-17B-128E-Instruct", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fmeta-icon-sm.c7b70d98.png&w=64&q=75", provider: "Meta" },
  { name: "gpt-oss-120b", imageUrl: "https://cloud.sambanova.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fopenai-sm.07334229.png&w=64&q=75", provider: "OpenAI" }
];

// ---------- Global State ----------
let currentUser = null;
let chats = [];
let currentChatId = null;
let messages = [];
let selectedModel = null;
let loading = false;
let sidebarOpen = false;
let modelSelectorOpen = false;
let settingsOpen = false;
let firestoreError = null;

let unsubscribeChats = null;
let unsubscribeMessages = null;

const appEl = document.getElementById('app');

// ---------- Helper Functions ----------
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString();
}

function escapeHtml(unsafe) {
  return unsafe.replace(/[&<>"']/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#039;';
    return m;
  });
}

function handleFirestoreError(error) {
  console.error('Firestore error:', error);
  firestoreError = error.code === 'permission-denied' ? 'Permission denied. Check Firestore rules.' : error.message;
  renderApp();
}

// ---------- Set Current Chat ----------
function setCurrentChatId(id) {
  currentChatId = id;
  if (unsubscribeMessages) unsubscribeMessages();
  if (currentUser && id) {
    const q = query(collection(db, 'users', currentUser.uid, 'chats', id, 'messages'), orderBy('timestamp', 'asc'));
    unsubscribeMessages = onSnapshot(q, 
      (snapshot) => {
        messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        firestoreError = null;
        renderApp();
      },
      handleFirestoreError
    );
  } else {
    messages = [];
  }
}

// ---------- API Call to Backend ----------
async function sendMessageToAPI(messagesList, model) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messagesList, model })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'API request failed');
  }
  const data = await response.json();
  return data.reply;
}

// ---------- Firestore Helpers ----------
async function createChat(userId, title, model) {
  const chatRef = await addDoc(collection(db, 'users', userId, 'chats'), {
    title: title || 'New Chat',
    model,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return chatRef.id;
}

async function addMessage(userId, chatId, role, content) {
  await addDoc(collection(db, 'users', userId, 'chats', chatId, 'messages'), {
    role,
    content,
    timestamp: serverTimestamp()
  });
  await updateDoc(doc(db, 'users', userId, 'chats', chatId), { updatedAt: serverTimestamp() });
}

// ---------- Render Functions ----------
function renderApp() {
  if (!currentUser) renderLogin();
  else renderChat();
}

function renderLogin() {
  appEl.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-white">
      <div class="w-full max-w-md p-6 space-y-4">
        <h2 class="text-2xl font-bold text-center" id="login-title">Login</h2>
        ${firestoreError ? `<div class="bg-red-100 text-red-700 p-2 rounded">${firestoreError}</div>` : ''}
        <form id="login-form" class="space-y-4">
          <input type="text" id="display-name" placeholder="Display Name" class="w-full border rounded-lg px-4 py-2 hidden">
          <input type="email" id="email" placeholder="Email" required class="w-full border rounded-lg px-4 py-2">
          <input type="password" id="password" placeholder="Password" required class="w-full border rounded-lg px-4 py-2">
          <button type="submit" class="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800" id="login-submit">Login</button>
        </form>
        <button id="toggle-auth-mode" class="w-full text-sm text-gray-600 hover:underline">Need an account? Sign Up</button>
      </div>
    </div>
  `;

  const toggleBtn = document.getElementById('toggle-auth-mode');
  const title = document.getElementById('login-title');
  const submitBtn = document.getElementById('login-submit');
  const displayNameInput = document.getElementById('display-name');
  const form = document.getElementById('login-form');
  let isLogin = true;

  toggleBtn.addEventListener('click', () => {
    isLogin = !isLogin;
    title.innerText = isLogin ? 'Login' : 'Sign Up';
    submitBtn.innerText = isLogin ? 'Login' : 'Sign Up';
    displayNameInput.classList.toggle('hidden', isLogin);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const displayName = document.getElementById('display-name').value;
    try {
      firestoreError = null;
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: displayName || 'User' });
      }
    } catch (error) {
      alert(error.message);
    }
  });
}

function renderChat() {
  const canChangeModel = !currentChatId || messages.length === 0;

  appEl.innerHTML = `
    <div class="flex h-full">
      <!-- Sidebar -->
      <div id="sidebar" class="fixed inset-y-0 left-0 w-80 bg-white shadow-lg transform transition-transform duration-300 z-30 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}">
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between p-4 border-b">
            <h2 class="text-lg font-semibold">Chats</h2>
            <button id="close-sidebar" class="p-1 rounded hover:bg-gray-100">✕</button>
          </div>
          <button id="new-chat-btn" class="flex items-center space-x-2 m-4 p-2 border rounded hover:bg-gray-50">
            <span>+</span><span>New Chat</span>
          </button>
          <div id="chat-list" class="flex-1 overflow-y-auto">
            ${chats.map(chat => `
              <div class="p-3 cursor-pointer hover:bg-gray-100 ${chat.id === currentChatId ? 'bg-gray-200' : ''}" data-chat-id="${chat.id}">
                <p class="font-medium truncate">${chat.title || 'Untitled'}</p>
                <p class="text-xs text-gray-500">${chat.model} • ${formatDate(chat.updatedAt)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Main Area -->
      <div class="flex-1 flex flex-col">
        ${firestoreError ? `<div class="bg-red-100 text-red-700 p-2 text-center border-b">${firestoreError}</div>` : ''}
        <header class="flex items-center justify-between px-4 py-2 border-b">
          <button id="menu-btn" class="p-2 rounded hover:bg-gray-100">☰</button>
          <div class="flex items-center space-x-4 relative">
            <button id="model-selector-btn" class="flex items-center space-x-2 px-3 py-1 rounded-full border ${!canChangeModel ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}" ${!canChangeModel ? 'disabled' : ''}>
              ${selectedModel ? `
                <img src="${models.find(m => m.name === selectedModel)?.imageUrl}" class="w-5 h-5 rounded-full">
                <span class="text-sm truncate max-w-[150px]">${selectedModel}</span>
              ` : '<span class="text-sm">Select Model</span>'}
            </button>
            <div class="relative">
              <button id="settings-btn" class="p-2 rounded hover:bg-gray-100">⚙️</button>
              <div id="settings-dropdown" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 hidden">
                <div class="px-4 py-2 text-sm text-gray-700 border-b">${currentUser.displayName || currentUser.email}</div>
                <button id="logout-btn" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Logout</button>
              </div>
            </div>
          </div>
        </header>

        <div id="message-list" class="flex-1 overflow-y-auto p-4 space-y-4">
          ${messages.map(msg => `
            <div class="flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}">
              <div class="max-w-[70%] rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-black text-white' : 'bg-gray-200 text-black'}">
                <p class="whitespace-pre-wrap">${escapeHtml(msg.content)}</p>
              </div>
            </div>
          `).join('')}
          ${loading ? `
            <div class="flex justify-start">
              <div class="bg-gray-200 rounded-lg px-4 py-2">
                <span class="typing-indicator"></span>
              </div>
            </div>
          ` : ''}
        </div>

        <form id="message-form" class="border-t p-4">
          <div class="flex items-center space-x-2">
            <input type="text" id="message-input" placeholder="Type your message..." class="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" autocomplete="off">
            <button type="submit" id="send-btn" class="bg-black text-white p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50" disabled>➤</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Model Selector Modal -->
    <div id="model-selector-modal" class="fixed inset-0 z-50 flex items-center justify-center ${modelSelectorOpen ? '' : 'hidden'}">
      <div class="absolute inset-0 bg-black/30" id="modal-overlay"></div>
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md z-10">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Select Model</h3>
          ${!canChangeModel ? '<p class="text-sm text-red-500 mt-1">Cannot change model after chat started.</p>' : ''}
        </div>
        <div class="p-4 max-h-96 overflow-y-auto">
          ${models.map(model => `
            <button class="w-full flex items-center space-x-3 p-3 rounded-lg mb-2 hover:bg-gray-100 ${selectedModel === model.name ? 'bg-blue-100' : ''} ${!canChangeModel ? 'opacity-50 cursor-not-allowed' : ''}" data-model-name="${model.name}" ${!canChangeModel ? 'disabled' : ''}>
              <img src="${model.imageUrl}" class="w-8 h-8 rounded-full">
              <div class="flex-1 text-left">
                <p class="font-medium">${model.name}</p>
                <p class="text-xs text-gray-500">${model.provider}</p>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('menu-btn').addEventListener('click', () => { sidebarOpen = true; renderChat(); });
  document.getElementById('close-sidebar').addEventListener('click', () => { sidebarOpen = false; renderChat(); });

  document.getElementById('new-chat-btn').addEventListener('click', async () => {
    if (!selectedModel) { alert('Select a model first'); return; }
    try {
      const chatId = await createChat(currentUser.uid, 'New Chat', selectedModel);
      setCurrentChatId(chatId);
      sidebarOpen = false;
      renderChat();
    } catch (error) { handleFirestoreError(error); }
  });

  document.querySelectorAll('#chat-list [data-chat-id]').forEach(el => {
    el.addEventListener('click', () => {
      setCurrentChatId(el.dataset.chatId);
      sidebarOpen = false;
      renderChat();
    });
  });

  const modelBtn = document.getElementById('model-selector-btn');
  if (canChangeModel) {
    modelBtn.addEventListener('click', () => { modelSelectorOpen = true; renderChat(); });
  }

  document.getElementById('settings-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('settings-dropdown');
    dropdown.classList.toggle('hidden');
    settingsOpen = !dropdown.classList.contains('hidden');
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
  });

  window.addEventListener('click', (e) => {
    if (!e.target.closest('#settings-btn') && settingsOpen) {
      document.getElementById('settings-dropdown').classList.add('hidden');
      settingsOpen = false;
    }
  });

  document.getElementById('modal-overlay')?.addEventListener('click', () => {
    modelSelectorOpen = false;
    renderChat();
  });

  document.querySelectorAll('#model-selector-modal [data-model-name]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!canChangeModel) return;
      selectedModel = btn.dataset.modelName;
      modelSelectorOpen = false;
      renderChat();
    });
  });

  const form = document.getElementById('message-form');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim() || loading;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content || loading) return;

    input.value = '';
    sendBtn.disabled = true;
    loading = true;
    renderChat(); // show typing

    try {
      if (!currentChatId) {
        if (!selectedModel) throw new Error('Select a model');
        const chatId = await createChat(currentUser.uid, content.substring(0,30)+'...', selectedModel);
        setCurrentChatId(chatId);
        await addMessage(currentUser.uid, chatId, 'user', content);
        const apiMessages = [{ role: 'user', content }];
        const aiResponse = await sendMessageToAPI(apiMessages, selectedModel);
        await addMessage(currentUser.uid, chatId, 'assistant', aiResponse);
      } else {
        await addMessage(currentUser.uid, currentChatId, 'user', content);
        const currentChat = chats.find(c => c.id === currentChatId);
        const apiMessages = [...messages, { role: 'user', content }].map(m => ({ role: m.role, content: m.content }));
        const aiResponse = await sendMessageToAPI(apiMessages, currentChat.model);
        await addMessage(currentUser.uid, currentChatId, 'assistant', aiResponse);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      loading = false;
      // messages update via snapshot
    }
  });

  sendBtn.disabled = true;
}

// ---------- Auth Observer ----------
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (unsubscribeChats) unsubscribeChats();
  if (unsubscribeMessages) unsubscribeMessages();

  if (user) {
    const q = query(collection(db, 'users', user.uid, 'chats'), orderBy('updatedAt', 'desc'));
    unsubscribeChats = onSnapshot(q, 
      (snapshot) => {
        chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        firestoreError = null;
        renderApp();
      },
      handleFirestoreError
    );
    if (currentChatId) setCurrentChatId(currentChatId);
    else messages = [];
  } else {
    chats = [];
    currentChatId = null;
    messages = [];
    selectedModel = null;
    firestoreError = null;
  }
  renderApp();
});

// Initial render
renderApp();
