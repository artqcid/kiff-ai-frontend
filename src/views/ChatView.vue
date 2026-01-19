<template>
  <div class="chat-view">
    <div class="chat-header">
      <h2>💬 Chat mit Agent</h2>
      <div class="chat-actions">
        <button @click="loadHistory" class="btn-secondary">🔄 Reload</button>
        <button @click="clearHistory" class="btn-danger">🗑️ Clear</button>
      </div>
    </div>

    <div class="status-bar" v-if="agentStatus">
      <span class="spinner"></span>
      <span>{{ agentStatus }}</span>
      <button @click="cancelRequest" class="btn-cancel">❌</button>
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
            <button v-if="msg.role === 'user'" @click="repeatMessage(msg)" class="btn-icon">🔄</button>
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
        @keydown.enter.prevent="sendMessage"
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
import { ref, onMounted, nextTick } from 'vue'
import { apiClient, type ChatHistoryItem } from '../api/client'

const messages = ref<ChatHistoryItem[]>([])
const userInput = ref('')
const loading = ref(false)
const agentStatus = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

onMounted(async () => {
  await loadHistory()
})

const loadHistory = async () => {
  try {
    const response = await apiClient.getChatHistory()
    messages.value = response.history || []
    await scrollToBottom()
  } catch (error) {
    console.error('Failed to load history:', error)
  }
}

const clearHistory = async () => {
  if (!confirm('Chat-Verlauf wirklich löschen?')) return
  
  try {
    await apiClient.clearChatHistory()
    messages.value = []
  } catch (error) {
    console.error('Failed to clear history:', error)
  }
}

const sendMessage = async () => {
  if (!userInput.trim() || loading.value) return

  const input = userInput.value
  userInput.value = ''
  loading.value = true
  agentStatus.value = '🤖 Agent denkt nach...'

  try {
    const response = await apiClient.chat({
      messages: [{ role: 'user', content: input }]
    })
    
    // Reload history to get updated messages
    await loadHistory()
    agentStatus.value = ''
  } catch (error) {
    console.error('Chat error:', error)
    agentStatus.value = ''
    messages.value.push({
      role: 'assistant',
      content: `❌ Fehler: ${error}`
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

const repeatMessage = async (msg: ChatHistoryItem) => {
  userInput.value = msg.content
  await sendMessage()
}

const cancelRequest = () => {
  loading.value = false
  agentStatus.value = ''
  if (messages.value.length > 0) {
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg.role === 'user') {
      lastMsg.cancelled = true
    }
  }
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
  height: calc(100vh - 4rem);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #333;
}

.chat-actions {
  display: flex;
  gap: 0.5rem;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: #2a2a2a;
  border-radius: 4px;
  margin-bottom: 1rem;
  color: #ffa500;
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

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background-color: #000;
  border: 1px solid #333;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.empty-state {
  color: #666;
  text-align: center;
  padding: 2rem;
}

.message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
}

.message.user {
  background-color: #0a2a52;
  margin-left: 10%;
}

.message.assistant {
  background-color: #151515;
  margin-right: 10%;
}

.message-cancelled {
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  background-color: #8b0000;
  color: #fff;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.message-content {
  line-height: 1.6;
  white-space: pre-wrap;
}

.message-time {
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.5rem;
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
}

textarea:focus {
  outline: none;
  border-color: #646cff;
}

textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #646cff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #535bf2;
}

.btn-secondary {
  background-color: #2a2a2a;
  color: white;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.btn-secondary:hover {
  background-color: #3a3a3a;
}

.btn-danger {
  background-color: #8b0000;
  color: white;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.btn-danger:hover {
  background-color: #a00000;
}

.btn-cancel {
  background-color: transparent;
  color: white;
  padding: 0.25rem 0.5rem;
  font-size: 1rem;
}

.btn-icon {
  background-color: transparent;
  color: white;
  padding: 0.25rem 0.5rem;
  font-size: 1rem;
}

.btn-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
