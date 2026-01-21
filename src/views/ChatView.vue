<template>
  <div class="chat-view">
    <div class="chat-header">
      <h2>💬 Chat mit Agent</h2>
      <div class="header-chips">
        <p class="model-chip" v-if="currentModel">Aktives Modell: {{ currentModel }}</p>
        <p class="profile-chip header" v-if="currentProfile">Aktives Profil: {{ currentProfile }}</p>
      </div>
    </div>

    <div class="status-bar" v-if="loading">
      <span class="spinner"></span>
      <span>{{ agentStatus }}</span>
      <button @click="cancelRequest" class="btn-cancel">❌ Abbrechen</button>
    </div>

    <div class="chat-messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="empty-state">
        Noch keine Nachrichten. Stelle eine Frage!
      </div>
      <div v-for="(msg, idx) in messages" :key="idx">
        <div v-if="msg.cancelled" class="message-cancelled">
          ❌ <strong>Anfrage abgebrochen</strong>
        </div>
        <div v-else :class="['message', msg.role]">
          <div class="message-header">
            <strong>{{ msg.role === 'user' ? '👤 Du' : '🤖 Agent' }}:</strong>
            <span v-if="msg.role === 'assistant'" class="profile-chip">Profil: {{ msg.profile || currentProfile || 'general_chat' }}</span>
            <button v-if="msg.role === 'user'" @click="repeatMessage(msg)" class="btn-icon" title="Frage wiederholen">
              🔄
            </button>
          </div>
          <div class="message-content">{{ msg.content }}</div>
          <div class="message-time" v-if="msg.timestamp">
            {{ formatTime(msg.timestamp) }}
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input">
      <textarea
        v-model="userInput"
        @keydown.enter.prevent="handleEnter"
        placeholder="z.B. 'Erstelle ein Betriebskonzept für unser Event...'"
        rows="3"
        :disabled="loading"
      ></textarea>
      <button @click="sendMessage" :disabled="!userInput.trim() || loading" class="btn-primary">
        {{ loading ? 'Sende...' : 'Senden ➤' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch, inject } from 'vue'
import { apiClient, type ChatHistoryItem } from '../api/client'

const props = defineProps<{
  serverRunning?: boolean
}>()

const messages = ref<ChatHistoryItem[]>([])
const userInput = ref('')
const loading = ref(false)
const agentStatus = ref('🤖 Anfrage wird verarbeitet...')
const currentModel = ref('')
const currentProfile = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const clearChatTrigger = inject<any>('clearChatTrigger', ref(0))

onMounted(async () => {
  // Load current profile first for fallback rendering
  try {
    const cp = await apiClient.getCurrentProfile()
    currentProfile.value = cp?.profile || 'general_chat'
    // Setze auch das aktive Modell aus dem aktuellen Profil
    if (cp?.model) {
      currentModel.value = cp.model
    }
  } catch (e) {
    currentProfile.value = 'general_chat'
  }
  await loadHistory()
})

// Watch for clear chat trigger from parent
watch(clearChatTrigger, () => {
  messages.value = [];
})

watch(() => props.serverRunning, (isRunning) => {
  if (!isRunning && loading.value) {
    cancelRequest()
  }
})

const loadHistory = async () => {
  try {
    const response = await apiClient.getChatHistory()
    const hist = (response.history || []).map((m: any) => {
      if (m.role === 'assistant' && !m.profile) {
        m.profile = currentProfile.value || 'general_chat'
      }
      return m
    })
    messages.value = hist
    await scrollToBottom()
  } catch (error) {
    console.error('Failed to load history:', error)
  }
}

const sendMessage = async () => {
  if (!userInput.value.trim() || loading.value) return

  if (!props.serverRunning) {
    alert('⚠️ Server ist nicht gestartet! Bitte starte den Server in der Sidebar.')
    return
  }

  // Refresh current profile in case it was changed in Settings
  try {
    const cp = await apiClient.getCurrentProfile()
    currentProfile.value = cp?.profile || currentProfile.value || 'general_chat'
    // Aktualisiere auch das aktive Modell
    if (cp?.model) {
      currentModel.value = cp.model
    }
  } catch {}

  const input = userInput.value
  userInput.value = ''
  loading.value = true
  agentStatus.value = '🤖 Modell lädt oder generiert Antwort...'

  // Add user message optimistically
  messages.value.push({
    role: 'user',
    content: input,
    timestamp: new Date().toISOString()
  })
  await scrollToBottom()

  try {
    const response = await apiClient.chat({
      messages: [{ role: 'user', content: input }]
    })
    
    // Add agent response
    messages.value.push({
      role: 'assistant',
      content: response.response,
      timestamp: new Date().toISOString(),
      profile: response.profile,
      model: response.model
    })

    if (response.model) {
      currentModel.value = response.model
    }
    
    // Reload history to sync with backend
    await loadHistory()
  } catch (error: any) {
    console.error('Chat error:', error)
    messages.value.push({
      role: 'assistant',
      content: `❌ Fehler: ${error.response?.data?.detail || error.message}`
    })
  } finally {
    loading.value = false
    agentStatus.value = ''
    await scrollToBottom()
  }
}

const repeatMessage = async (msg: ChatHistoryItem) => {
  if (loading.value) return
  userInput.value = msg.content
  await nextTick()
  await sendMessage()
}

const cancelRequest = () => {
  loading.value = false
  agentStatus.value = ''
  
  if (messages.value.length > 0) {
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.role === 'user') {
      messages.value.push({
        role: 'assistant',
        content: '❌ Anfrage abgebrochen',
        cancelled: true
      })
    }
  }
}

const handleEnter = async (e: KeyboardEvent) => {
  if (e.shiftKey) {
    // Shift+Enter = neue Zeile (Standard-Verhalten)
    return
  }
  // Enter ohne Shift = senden
  await sendMessage()
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 1.5rem;
}

.chat-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #2a2a2a;
}

.chat-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
}

.header-chips {
  display: flex;
  gap: 0.5rem;
}

.model-chip {
  margin-top: 0.25rem;
  color: #9ca3af;
  font-size: 0.95rem;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  margin-bottom: 1rem;
  color: #ffa500;
}

.status-bar > span:first-of-type {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 3px solid rgba(255, 165, 0, 0.3);
  border-top-color: #ffa500;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-cancel:hover {
  background-color: #dc2626;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background-color: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #0a0a0a;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #2a2a2a;
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #3a3a3a;
}

.empty-state {
  color: #666;
  text-align: center;
  padding: 3rem 1rem;
  font-size: 1rem;
}

.message {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 8px;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  background-color: #0a2a52;
  margin-left: 10%;
  border-left: 3px solid #646cff;
}

.message.assistant {
  background-color: #1a1a1a;
  margin-right: 10%;
  border-left: 3px solid #10b981;
}

.message-cancelled {
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  background-color: #4d1a1a;
  border-left: 3px solid #ef4444;
  color: #f87171;
  font-weight: 500;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.message-header strong {
  font-size: 0.875rem;
  font-weight: 600;
}

.btn-icon {
  background: transparent;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.btn-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.profile-chip {
  margin-left: auto;
  margin-right: 0.5rem;
  background-color: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  color: #9ca3af;
}

.profile-chip.header {
  margin-left: 0;
}

.message-content {
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-time {
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.5rem;
  text-align: right;
}

.chat-input {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

textarea {
  flex: 1;
  padding: 0.75rem;
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.87);
  font-family: inherit;
  font-size: 1rem;
  resize: none;
  transition: border-color 0.2s;
}

textarea:focus {
  outline: none;
  border-color: #646cff;
}

textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background-color: #646cff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  background-color: #535bf2;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
