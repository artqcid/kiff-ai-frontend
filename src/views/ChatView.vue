<template>
  <div class="chat-view">
    <div class="chat-layout">
      <div class="chat-main">
        <div class="chat-header">
          <div class="header-content">
            <div class="header-row-main">
              <div class="header-info">
                <span v-if="currentProfile" class="profile-chip"><strong>Profil:</strong> {{ currentProfileDisplayName }}</span>
                <span v-if="currentModel" class="model-chip"><strong>Model:</strong> {{ currentModelDisplayName }}</span>
                <span v-if="currentProvider" class="provider-chip">Provider: {{ currentProviderDisplayName }}</span>
              </div>
              <button @click="clearChat" class="btn-clear-chat" title="Chat-Verlauf löschen">
                🗑️ Chat löschen
              </button>
            </div>
            <div class="header-row-limits" v-if="rateLimits">
              <span class="limits-info">{{ rateLimits }}</span>
            </div>
          </div>
        </div>

        <!-- Clear Chat Success Message -->
        <div v-if="clearChatSuccess" class="clear-chat-success">
          ✅ Chat-Verlauf erfolgreich gelöscht
        </div>

        <!-- Fallback Banner -->
        <div v-if="showFallbackBanner" class="fallback-banner">
          ⚠️ Provider derzeit nicht verfügbar - Fallback zu Lokal aktiviert
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
            <div v-else class="message-wrapper" :class="msg.role">
              <div v-if="msg.role === 'user' && msg.timestamp" class="message-time-outside left">
                {{ formatTime(msg.timestamp) }}
              </div>
              <div :class="['message', msg.role]">
                <div class="message-header">
                  <strong>{{ msg.role === 'user' ? '👤 Du' : '🤖 Agent' }}:</strong>
                  <button v-if="msg.role === 'assistant'" @click="copyMessage(msg.content, idx)" class="btn-copy-chip agent-copy" :class="{ copied: copiedMessageId === idx }">
                    {{ copiedMessageId === idx ? 'Copied ✓' : 'Copy' }}
                  </button>
                  <span v-if="msg.role === 'assistant'" class="profile-chip">Profil: {{ msg.profile || currentProfile || 'general_chat' }}</span>
                  <button v-if="msg.role === 'user'" @click="copyMessage(msg.content, idx)" class="btn-copy-chip" :class="{ copied: copiedMessageId === idx }">
                    {{ copiedMessageId === idx ? 'Copied ✓' : 'Copy' }}
                  </button>
                  <button v-if="msg.role === 'user'" @click="repeatMessage(msg)" class="btn-icon btn-repeat" data-tooltip="Frage wiederholen">
                    🔄
                  </button>
                </div>
                <div class="message-content">{{ msg.content }}</div>
              </div>
              <div v-if="msg.role === 'assistant' && msg.timestamp" class="message-time-outside right">
                {{ formatTime(msg.timestamp) }}
              </div>
            </div>
          </div>
        </div>

        <div class="chat-input">
          <textarea
            ref="inputTextarea"
            v-model="userInput"
            @keydown.enter="handleEnter"
            placeholder="z.B. 'Erstelle ein Betriebskonzept für unser Event...'"
            rows="3"
            :disabled="loading"
          ></textarea>
          <button @click="sendMessage" :disabled="!userInput.trim() || loading" class="btn-primary">
            {{ loading ? 'Sende...' : 'Senden ➤' }}
          </button>
        </div>
      </div>

      <aside class="chat-sidebar">
        <div class="sidebar-header">Verlauf</div>
        <div class="conversation-list">
          <div v-if="conversationOverview.length === 0" class="no-conversations">Noch keine Verläufe</div>
          <div
            v-for="conv in conversationOverview"
            :key="conv.id"
            class="conversation-chip"
          >
            <div class="chip-header">
              <div class="chip-title">{{ conv.title }}</div>
              <button class="chip-delete" @click.stop="deleteConversation(conv)" title="Verlauf löschen">✕</button>
            </div>
            <div class="chip-meta">
              <span class="chip-provider">{{ conv.provider }}</span>
              <span class="chip-profile">{{ conv.profile }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, inject, computed } from 'vue'
import { apiClient, type ChatHistoryItem, type CurrentProviderResponse } from '../api/client'

const props = defineProps<{
  serverRunning?: boolean
}>()

const messages = ref<ChatHistoryItem[]>([])
const userInput = ref('')
const inputTextarea = ref<HTMLTextAreaElement | null>(null)
const loading = ref(false)
const agentStatus = ref('🤖 Anfrage wird verarbeitet...')
const copiedMessageId = ref<number | null>(null)
const currentModel = ref('')
const currentProfile = ref('')
const currentProvider = ref('')
const currentModelShortName = ref('')
const currentProfileDisplayName = ref('')
const currentProviderDisplayName = ref('')
const rateLimits = ref('')
const maxRateLimits = ref({ requests: '', tokens: '' })
const conversationOverview = ref<Array<{ id: string; title: string; provider: string; profile: string; timestamp?: string }>>([])

// Load cache from localStorage
const loadCacheFromStorage = () => {
  try {
    const stored = localStorage.getItem('rateLimitsCache')
    return stored ? JSON.parse(stored) : {}
  } catch (e) {
    console.error('Failed to load rate limits cache:', e)
    return {}
  }
}

// Cache für aktuelle Rate Limits pro Model (key: modelId)
const rateLimitsCache = ref<Record<string, { 
  remaining_requests: string, 
  remaining_tokens: string, 
  limit_requests: string, 
  limit_tokens: string,
  request_unit: string,
  token_unit: string,
  full_request_limit: string,
  full_token_limit: string
}>>(loadCacheFromStorage())

// Save cache to localStorage whenever it changes
const saveCacheToStorage = () => {
  try {
    localStorage.setItem('rateLimitsCache', JSON.stringify(rateLimitsCache.value))
  } catch (e) {
    console.error('Failed to save rate limits cache:', e)
  }
}

const messagesContainer = ref<HTMLElement | null>(null)
const clearChatTrigger = inject<any>('clearChatTrigger', ref(0))
const showFallbackBanner = ref(false)
const clearChatSuccess = ref(false)
let clearSuccessTimer: number | null = null

// Computed properties for display names
const currentModelDisplayName = computed(() => currentModelShortName.value || currentModel.value)

// Event handlers for model/profile changes
const handleModelChanged = async () => {
  await loadCurrentState()
}
const handleProfileChanged = async () => {
  await loadCurrentState()
}

onMounted(async () => {
  await loadCurrentState()
  await loadHistory()
  
  // Listen for model/profile changes from SettingsView
  window.addEventListener('modelChanged', handleModelChanged)
  window.addEventListener('profileChanged', handleProfileChanged)
})

// Cleanup event listeners
onUnmounted(() => {
  window.removeEventListener('modelChanged', handleModelChanged)
  window.removeEventListener('profileChanged', handleProfileChanged)
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

const loadCurrentState = async () => {
  try {
    const current: CurrentProviderResponse = await apiClient.getCurrentProvider()
    
    currentProfile.value = current.profile
    currentProvider.value = current.provider
    currentModel.value = current.model
    currentProviderDisplayName.value = current.provider_display_name
    currentProfileDisplayName.value = current.profile_display_name
    currentModelShortName.value = current.model_short_name
    
    // Load rate limits for remote providers; local has no limits
    if (current.provider !== 'lokal') {
      try {
        // Check cache first for current model
        const cachedLimits = rateLimitsCache.value[current.model]
        if (cachedLimits) {
          // Use cached values (already consumed)
          maxRateLimits.value = {
            requests: cachedLimits.limit_requests,
            tokens: cachedLimits.limit_tokens
          }
          
          // Build display with remaining values
        const reqDisplay = cachedLimits.remaining_requests && cachedLimits.full_request_limit
          ? `${cachedLimits.remaining_requests} von ${cachedLimits.full_request_limit}`
          : cachedLimits.full_request_limit || 'N/A'
        
        // For tokens, show remaining for the FIRST limit (minute), keep second (day) unchanged
        let tokenDisplay = 'N/A'
        if (cachedLimits.full_token_limit) {
          const tokenParts = cachedLimits.full_token_limit.split(',')
          if (tokenParts.length > 1) {
            // Multiple limits: show first with "xxx von", second as-is
            const firstLimit = tokenParts[0].trim()
            const secondLimit = tokenParts[1].trim()
            const remainingVal = cachedLimits.remaining_tokens || 'xxx'
            tokenDisplay = `${remainingVal} von ${firstLimit}, ${secondLimit}`
              // Single limit
              tokenDisplay = cachedLimits.remaining_tokens
                ? `${cachedLimits.remaining_tokens} von ${cachedLimits.full_token_limit}`
                : cachedLimits.full_token_limit
            }
          }
          
          rateLimits.value = `🔄 Req Limit: ${reqDisplay} | 🧮 Token Limit: ${tokenDisplay}`
        } else {
          // No cache, load fresh limits from model metadata
          const models = await apiClient.getProfileModels(current.profile, current.provider)
          const modelInfo = models.models.find(m => m.model_id === current.model)
          if (modelInfo?.metadata) {
            let reqLimit = modelInfo.metadata.request_limit
            let tokenLimit = modelInfo.metadata.token_limit
            
            // Clean up limits (remove text in parentheses)
            let reqDisplay = reqLimit ? reqLimit.split('(')[0].trim() : ''
            let tokenDisplay = tokenLimit ? tokenLimit.split('(')[0].trim() : ''
            
            // Extract last numeric value and unit for tracking consumption
            let reqUnit = ''
            let tokenUnit = ''
            let reqValue = ''
            let tokenValue = ''
            
            if (reqDisplay) {
              const parts = reqDisplay.split(',')
              const lastPart = parts[parts.length - 1].trim()
              const match = lastPart.match(/(\d+\.?\d*[KM]?)(\/[a-z]+)/i)
              if (match) {
                reqValue = match[1]
                reqUnit = match[2]
              }
            }
            
            if (tokenDisplay) {
              const parts = tokenDisplay.split(',')
              const lastPart = parts[parts.length - 1].trim()
              const match = lastPart.match(/(\d+\.?\d*[KM]?)(\/[a-z]+)/i)
              if (match) {
                tokenValue = match[1]
                tokenUnit = match[2]
              }
            }
            
            if (reqDisplay || tokenDisplay) {
              // Store max limits and units for later use
              maxRateLimits.value = { requests: reqValue || '', tokens: tokenValue || '' }
              
              // Check if cache needs update (config changed)
              const existingCache = rateLimitsCache.value[current.model]
              const configChanged = existingCache && (
                existingCache.full_request_limit !== reqDisplay ||
                existingCache.full_token_limit !== tokenDisplay
              )
              
              // Initialize cache with max values (no consumption yet) or update if config changed
              if (!existingCache || configChanged) {
                rateLimitsCache.value[current.model] = {
                  remaining_requests: '', // Empty until first API call
                  remaining_tokens: '',   // Empty until first API call
                  limit_requests: reqValue || '',
                  limit_tokens: tokenValue || '',
                  request_unit: reqUnit,
                  token_unit: tokenUnit,
                  full_request_limit: reqDisplay,
                  full_token_limit: tokenDisplay
                }
                saveCacheToStorage()
                // Show initial limits without "von" (no consumption data yet)
                rateLimits.value = `🔄 Req Limit: ${reqDisplay || 'N/A'} | 🧮 Token Limit: ${tokenDisplay || 'N/A'}`
              } else {
                // Use cached display (already has consumption data)
                const cachedLimits = existingCache
                const reqDisplayCached = cachedLimits.remaining_requests && cachedLimits.full_request_limit
                  ? `${cachedLimits.remaining_requests} von ${cachedLimits.full_request_limit}`
                  : cachedLimits.full_request_limit || 'N/A'
                
                let tokenDisplayCached = 'N/A'
                if (cachedLimits.full_token_limit) {
                  const tokenParts = cachedLimits.full_token_limit.split(',')
                  if (tokenParts.length > 1) {
                    const firstLimit = tokenParts[0].trim()
                    const secondLimit = tokenParts[1].trim()
                    const remainingVal = cachedLimits.remaining_tokens || 'xxx'
                    tokenDisplayCached = `${remainingVal} von ${firstLimit}, ${secondLimit}`
                  } else {
                    tokenDisplayCached = cachedLimits.remaining_tokens
                      ? `${cachedLimits.remaining_tokens} von ${cachedLimits.full_token_limit}`
                      : cachedLimits.full_token_limit
                  }
                }
                
                rateLimits.value = `🔄 Req Limit: ${reqDisplayCached} | 🧮 Token Limit: ${tokenDisplayCached}`
              }
            } else {
              rateLimits.value = ''
            }
          } else {
            rateLimits.value = ''
          }
        }
      } catch (e) {
        console.error('Failed to load rate limits:', e)
        rateLimits.value = ''
      }
    } else {
      rateLimits.value = '🔄 Req Limit: unlimitiert | 🧮 Token Limit: unlimitiert'
    }
  } catch (e) {
    console.error('Failed to load current state:', e)
    currentProfile.value = 'general_chat'
    currentProvider.value = 'lokal'
    rateLimits.value = ''
  }
}

const loadHistory = async () => {
  try {
    const response = await apiClient.getChatHistory()
    const hist = (response.history || []).map((m: any) => {
      if (m.role === 'assistant' && !m.profile) {
        m.profile = currentProfile.value || 'general_chat'
      }
      if (m.role === 'assistant' && !m.provider) {
        m.provider = currentProvider.value
      }
      return m
    })
    messages.value = hist
    buildConversationOverview()
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

  // Refresh current state
  await loadCurrentState()

  const input = userInput.value
  userInput.value = ''
  loading.value = true
  agentStatus.value = '🤖 Modell lädt oder generiert Antwort...'
  showFallbackBanner.value = false

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
    
    // Update rate limits from response metadata (remote) or mark unlimited (local)
    if (currentProvider.value === 'lokal') {
      rateLimits.value = '🔄 Req Limit: unlimitiert | 🧮 Token Limit: unlimitiert'
    } else if (response.metadata?.rate_limits) {
      const rl = response.metadata.rate_limits
      
      // Update max limits if provided in response (override stored values)
      if (rl.limit_requests) {
        maxRateLimits.value.requests = rl.limit_requests
      }
      if (rl.limit_tokens) {
        maxRateLimits.value.tokens = rl.limit_tokens
      }
      
      if (rl.remaining_requests || rl.remaining_tokens) {
        // Get current cache to preserve full limit strings from config
        const currentCache = rateLimitsCache.value[currentModel.value]
        
        // Update limits from API if provided (overrides config)
        if (rl.limit_requests) {
          maxRateLimits.value.requests = rl.limit_requests
        }
        if (rl.limit_tokens) {
          maxRateLimits.value.tokens = rl.limit_tokens
        }
        
        // Cache the rate limits for this model
        rateLimitsCache.value[currentModel.value] = {
          remaining_requests: rl.remaining_requests || '',
          remaining_tokens: rl.remaining_tokens || '',
          limit_requests: rl.limit_requests || maxRateLimits.value.requests,
          limit_tokens: rl.limit_tokens || maxRateLimits.value.tokens,
          request_unit: currentCache?.request_unit || '/min',
          token_unit: currentCache?.token_unit || '/day',
          full_request_limit: currentCache?.full_request_limit || `${rl.limit_requests || maxRateLimits.value.requests}/min`,
          full_token_limit: currentCache?.full_token_limit || ''
        }
        saveCacheToStorage()
        
        // Build display: use API values directly
        const reqLimit = rl.limit_requests || maxRateLimits.value.requests
        const reqDisplay = rl.remaining_requests
          ? `${rl.remaining_requests} von ${reqLimit}/min`
          : `${reqLimit}/min`
        
        // For tokens: build full display from config
        let tokenDisplay = 'N/A'
        if (currentCache?.full_token_limit) {
          const tokenParts = currentCache.full_token_limit.split(',')
          if (tokenParts.length > 1) {
            // Multiple limits: show first with remaining, second unchanged
            const firstLimit = tokenParts[0].trim()
            const secondLimit = tokenParts[1].trim()
            const remainingVal = rl.remaining_tokens || 'xxx'
            tokenDisplay = `${remainingVal} von ${firstLimit}, ${secondLimit}`
          } else {
            // Single limit
            const tokenLimit = rl.limit_tokens || maxRateLimits.value.tokens
            tokenDisplay = rl.remaining_tokens
              ? `${rl.remaining_tokens} von ${tokenLimit}/min`
              : `${tokenLimit}/min`
          }
        } else {
          // Fallback: simple display
          const tokenLimit = rl.limit_tokens || maxRateLimits.value.tokens
          tokenDisplay = rl.remaining_tokens
            ? `${rl.remaining_tokens} von ${tokenLimit}/min`
            : `${tokenLimit}/min`
        }
        
        rateLimits.value = `🔄 Req Limit: ${reqDisplay} | 🧮 Token Limit: ${tokenDisplay}`
      }
    }
    
    // Check for fallback indicator
    if (response.response.startsWith('⚠️')) {
      showFallbackBanner.value = true
      setTimeout(() => {
        showFallbackBanner.value = false
      }, 5000)
    }
    
    // Add agent response
    messages.value.push({
      role: 'assistant',
      content: response.response,
      timestamp: new Date().toISOString(),
      profile: response.profile,
      model: response.model,
      provider: currentProvider.value
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
    
    // Refocus textarea for next input
    await nextTick()
    inputTextarea.value?.focus()
  }
}

const repeatMessage = async (msg: ChatHistoryItem) => {
  if (loading.value) return
  userInput.value = msg.content
  await nextTick()
  await sendMessage()
}

const copyMessage = async (content: string, messageIndex: number) => {
  try {
    await navigator.clipboard.writeText(content)
    copiedMessageId.value = messageIndex
    setTimeout(() => {
      copiedMessageId.value = null
    }, 2000)
  } catch (error) {
    console.error('Failed to copy message:', error)
  }
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

const buildConversationOverview = () => {
  const map = new Map<string, { id: string; title: string; provider: string; profile: string; timestamp?: string }>()
  let lastUser: ChatHistoryItem | null = null

  for (const msg of messages.value) {
    if (msg.role === 'user') {
      lastUser = msg
      continue
    }
    if (msg.role === 'assistant' && msg.provider && msg.profile) {
      const key = `${msg.provider}::${msg.profile}`
      const rawTitle = lastUser?.content?.trim() || 'Neue Unterhaltung'
      const titleLine = rawTitle.split('\n')[0] || rawTitle
      const title = titleLine.length > 80 ? `${titleLine.slice(0, 80)}…` : titleLine
      map.set(key, {
        id: key,
        title,
        provider: msg.provider,
        profile: msg.profile,
        timestamp: msg.timestamp
      })
    }
  }

  conversationOverview.value = Array.from(map.values()).sort((a, b) => {
    const ta = a.timestamp || ''
    const tb = b.timestamp || ''
    return tb.localeCompare(ta)
  })
}

const deleteConversation = async (conv: { provider: string; profile: string }) => {
  if (!confirm('⚠️ Verlauf wirklich löschen?')) return
  try {
    await apiClient.deleteChatHistoryForContext(conv.provider, conv.profile)
    await loadHistory()
  } catch (error) {
    console.error('Failed to delete conversation:', error)
  }
}

const clearChat = async () => {
  if (!confirm('⚠️ Chat-Verlauf wirklich löschen?')) return
  
  try {
    await apiClient.clearChatHistory()
    messages.value = []
    conversationOverview.value = []
    showFallbackBanner.value = false
    
    // Show success message
    clearChatSuccess.value = true
    
    // Clear any existing timer
    if (clearSuccessTimer) {
      clearTimeout(clearSuccessTimer)
    }
    
    // Hide after 5 seconds
    clearSuccessTimer = window.setTimeout(() => {
      clearChatSuccess.value = false
      clearSuccessTimer = null
    }, 5000)
  } catch (error) {
    console.error('Failed to clear chat:', error)
    alert('❌ Fehler beim Löschen des Chats')
  }
}
const handleEnter = async (e: KeyboardEvent) => {
  if (e.shiftKey) {
    // Shift+Enter = neue Zeile (Standard-Verhalten)
    return
  }
  // Enter ohne Shift = senden
  e.preventDefault()
  if (userInput.value.trim() && !loading.value) {
    await sendMessage()
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
  height: 100vh;
  padding: 1.5rem;
}

.chat-layout {
  display: flex;
  height: 100%;
  gap: 1rem;
}

.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-sidebar {
  width: 240px;
  min-width: 200px;
  background-color: #0a0a0a;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sidebar-header {
  font-weight: 600;
  font-size: 0.95rem;
  color: #e5e7eb;
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  max-height: calc(100vh - 200px);
  padding-right: 0.25rem;
}

.conversation-chip {
  padding: 0.75rem;
  border-radius: 8px;
  background-color: #111;
  border: 1px solid #1f1f1f;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  cursor: default;
}

.chip-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chip-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: #f3f4f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-delete {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.1rem 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.chip-delete:hover {
  background-color: #2a2a2a;
  color: #f87171;
}

.chip-meta {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: #9ca3af;
}

.chip-provider,
.chip-profile {
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 0.15rem 0.5rem;
}

.no-conversations {
  color: #777;
  font-size: 0.85rem;
  padding: 0.5rem 0.25rem;
}

.chat-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #2a2a2a;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.header-row-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.header-row-limits {
  display: flex;
  align-items: center;
}

.header-info {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.limits-info {
  font-size: 0.875rem;
  color: #888;
  font-family: monospace;
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
}

.header-left {
  flex: 1;
  min-width: 0;
}

.header-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.model-chip,
.profile-chip,
.provider-chip,
.limits-chip {
  background-color: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 0.25rem 0.75rem;
  font-size: 0.9rem;
  color: #9ca3af;
  font-weight: normal;
}

.model-chip strong,
.profile-chip strong {
  font-weight: 600;
}

.provider-chip {
  color: #60a5fa;
  border-color: #3b82f6;
}

.limits-chip {
  color: #9ca3af;
  border-color: #4b5563;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}

.btn-clear-chat {
  padding: 0.5rem 1rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-clear-chat:hover {
  background-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

.btn-clear-chat:active {
  transform: translateY(0);
}

.clear-chat-success {
  background-color: #22c55e33;
  border: 1px solid #22c55e;
  color: #4ade80;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fallback-banner {
  background-color: #f59e0b33;
  border: 1px solid #f59e0b;
  color: #fbbf24;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
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
  padding: 1rem;
  border-radius: 8px;
  animation: fadeIn 0.3s ease-in;
  flex: 1;
  min-width: 0;
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
  background-color: #353535;
  border-left: 3px solid #646cff;
}

.message.assistant {
  background-color: #1a1a1a;
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
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
  filter: brightness(0.7);
}

.btn-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
  filter: brightness(1);
}

.btn-copy-chip {
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  color: #888;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  margin-left: auto;
  margin-right: 0.5rem;
  font-size: 0.75rem;
  border-radius: 4px;
  transition: all 0.2s;
  font-family: inherit;
}

.btn-copy-chip.agent-copy {
  margin-left: auto;
  margin-right: 0.5rem;
}

.btn-copy-chip:hover {
  border-color: #4ade80;
  color: #4ade80;
}

.btn-copy-chip.copied {
  background-color: #4ade8022;
  border-color: #4ade80;
  color: #4ade80;
}

.profile-chip {
  margin-left: 0;
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

.message-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.message-wrapper.user {
  margin-left: 10%;
}

.message-wrapper.assistant {
  margin-right: 10%;
}

.message-time-outside {
  font-size: 0.7rem;
  color: #9ca3af;
  white-space: nowrap;
  padding-top: 1rem;
  flex-shrink: 0;
}

.message-time-outside.left {
  order: -1;
}

.message-time-outside.right {
  order: 1;
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
  padding: 0.5rem 1rem;
  background-color: #15803d;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  background-color: #22c55e;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Custom Tooltip */
.btn-repeat {
  position: relative;
}

.btn-repeat[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #2a2a2a;
  color: #fff;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  white-space: nowrap;
  margin-bottom: 0.5rem;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.btn-repeat[data-tooltip]:hover::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #2a2a2a;
  margin-bottom: -0.3rem;
  z-index: 1000;
}
</style>
