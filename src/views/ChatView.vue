<template>
  <div class="chat-view">
    <h2>Chat</h2>
    <div class="chat-messages" ref="messagesContainer">
      <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.role]">
        <div class="message-content">{{ msg.content }}</div>
      </div>
    </div>
    <div class="chat-input">
      <textarea
        v-model="userInput"
        @keydown.enter.prevent="sendMessage"
        placeholder="Type your message..."
        rows="3"
      ></textarea>
      <button @click="sendMessage" :disabled="!userInput.trim() || loading">
        {{ loading ? 'Sending...' : 'Send' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { apiClient, type ChatMessage } from '../api/client'

const messages = ref<ChatMessage[]>([])
const userInput = ref('')
const loading = ref(false)

const sendMessage = async () => {
  if (!userInput.value.trim() || loading.value) return

  const userMessage: ChatMessage = {
    role: 'user',
    content: userInput.value
  }
  
  messages.value.push(userMessage)
  const input = userInput.value
  userInput.value = ''
  loading.value = true

  try {
    const response = await apiClient.chat({
      messages: messages.value
    })
    
    messages.value.push({
      role: 'assistant',
      content: response.response
    })
  } catch (error) {
    console.error('Chat error:', error)
    messages.value.push({
      role: 'assistant',
      content: 'Error: Could not get response from server'
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 4rem);
}

h2 {
  margin-bottom: 1rem;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background-color: #1a1a1a;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
}

.message.user {
  background-color: #646cff;
  margin-left: 20%;
  text-align: right;
}

.message.assistant {
  background-color: #2a2a2a;
  margin-right: 20%;
}

.chat-input {
  display: flex;
  gap: 1rem;
}

textarea {
  flex: 1;
  padding: 0.75rem;
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.87);
  font-family: inherit;
  resize: none;
}

textarea:focus {
  outline: none;
  border-color: #646cff;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
