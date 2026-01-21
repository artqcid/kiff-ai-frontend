<template>
  <div class="settings-view" :style="{ '--sidebar-width': sidebarWidth + 'px' }">
    <h2>⚙️ KIFF Settings</h2>

    <!-- Provider Selection Section -->
    <div class="settings-section accordion">
      <div class="accordion-header" @click="toggleSection('provider')">
        <span class="icon">{{ expanded.provider ? '▼' : '▶' }}</span>
        <h3>{{ narrow ? 'Prov.' : '🌐 LLM Provider' }}</h3>
      </div>
      <div v-show="expanded.provider" class="accordion-content">
        <div class="provider-list">
          <div 
            v-for="provider in providers" 
            :key="provider.name"
            class="provider-item"
            :class="{ 
              active: provider.is_current, 
              disabled: provider.requires_api_key && !provider.has_api_key 
            }"
            @click="selectProvider(provider)"
          >
            <div class="provider-radio">
              <input 
                type="radio" 
                :value="provider.name" 
                v-model="currentProvider"
                :disabled="provider.requires_api_key && !provider.has_api_key"
              />
            </div>
            <div class="provider-info">
              <div class="provider-name">
                {{ provider.display_name }}
                <span v-if="provider.requires_api_key && !provider.has_api_key" class="badge">API-Key fehlt</span>
              </div>
              <div class="provider-description">{{ provider.description }}</div>
            </div>
          </div>
        </div>
        
        <!-- API Key Dialog -->
        <div v-if="showApiKeyDialog" class="api-key-dialog">
          <h4>🔑 API-Key für {{ selectedProviderForKey?.display_name }}</h4>
          <input 
            v-model="apiKeyInput"
            type="password"
            placeholder="API-Key eingeben..."
            class="api-key-input"
          />
          <div class="dialog-buttons">
            <button @click="testApiKey" :disabled="!apiKeyInput || validating" class="btn-primary">
              {{ validating ? 'Teste...' : 'Testen & Speichern' }}
            </button>
            <button @click="cancelApiKey" class="btn-secondary">
              Später
            </button>
          </div>
          <p v-if="apiKeyMessage" :class="['api-key-message', apiKeyValid ? 'success' : 'error']">
            {{ apiKeyMessage }}
          </p>
        </div>
      </div>
    </div>

    <!-- Profile Selection Section -->
    <div class="settings-section accordion">
      <div class="accordion-header" @click="toggleSection('profile')">
        <span class="icon">{{ expanded.profile ? '▼' : '▶' }}</span>
        <h3>{{ narrow ? 'Prof.' : '👤 Agent-Profil' }}</h3>
      </div>
      <div v-show="expanded.profile" class="accordion-content">
        <div class="profile-list">
          <div 
            v-for="profile in profiles" 
            :key="profile.name"
            class="profile-item"
            :class="{ active: profile.name === selectedProfile }"
            @click="selectProfile(profile.name)"
          >
            <div class="profile-radio">
              <input type="radio" :value="profile.name" v-model="selectedProfile" />
            </div>
            <div class="profile-info">
              <div class="profile-name">{{ profile.display_name || profile.name }}</div>
              <div class="profile-description">{{ profile.description }}</div>
            </div>
          </div>
        </div>
        <button 
          @click="applyProfile" 
          :disabled="loading || !selectedProfile" 
          class="btn-primary"
        >
          Profil anwenden
        </button>
      </div>
    </div>

    <!-- Model Selection Section -->
    <div class="settings-section accordion">
      <div class="accordion-header" @click="toggleSection('model')">
        <span class="icon">{{ expanded.model ? '▼' : '▶' }}</span>
        <h3>{{ narrow ? 'Mod.' : '🤖 Modell & Details' }}</h3>
      </div>
      <div v-show="expanded.model" class="accordion-content">
        <div v-if="availableModels.length > 0" class="form-group">
          <label for="model-select">Verfügbare Modelle für dieses Profil:</label>
          <select id="model-select" v-model="selectedModel" :disabled="loading">
            <option v-for="model in availableModels" :key="model.model_id" :value="model.model_id">
              {{ model.display_name }}
            </option>
          </select>
          
          <!-- Model Details -->
          <div v-if="selectedModelInfo" class="model-details">
            <div class="detail-row">
              <span class="detail-label">📊 Context:</span>
              <span class="detail-value">{{ selectedModelInfo.metadata?.context || 'N/A' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">⚡ Speed:</span>
              <span class="detail-value">{{ selectedModelInfo.metadata?.speed || 'N/A' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">💰 Preis:</span>
              <span class="detail-value">{{ selectedModelInfo.metadata?.cost || 'N/A' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">🔄 Req Limit:</span>
              <span class="detail-value">{{ selectedModelInfo.metadata?.request_limit || 'N/A' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">🧮 Token Limit:</span>
              <span class="detail-value">{{ selectedModelInfo.metadata?.token_limit || 'N/A' }}</span>
            </div>
          </div>
          
          <button 
            @click="saveSettings" 
            :disabled="loading" 
            class="btn-success"
          >
            💾 Speichern
          </button>
        </div>
        <div v-else class="no-models">
          <p>⚠️ Keine Modelle für dieses Profil und Provider verfügbar.</p>
          <p class="hint">Wähle ein anderes Profil oder Provider.</p>
        </div>
      </div>
    </div>

    <!-- Status Messages -->
    <div v-if="statusMessage" :class="['status-message', statusType]">
      {{ statusMessage }}
    </div>

    <!-- Resize Handle -->
    <div 
      class="resize-handle" 
      @mousedown="startResize"
      title="Sidebar-Breite anpassen"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { apiClient, type Provider, type Profile, type Model, type ProfileModelsResponse } from '../api/client'

// State
const providers = ref<Provider[]>([])
const profiles = ref<Profile[]>([])
const availableModels = ref<Model[]>([])
const currentProvider = ref<string>('lokal')
const selectedProfile = ref<string>('general_chat')
const selectedModel = ref<string>('')
const loading = ref(false)
const statusMessage = ref('')
const statusType = ref<'success' | 'error' | 'info'>('info')
const validating = ref(false)

// API Key Dialog
const showApiKeyDialog = ref(false)
const selectedProviderForKey = ref<Provider | null>(null)
const apiKeyInput = ref('')
const apiKeyMessage = ref('')
const apiKeyValid = ref(false)

// Accordion state
const expanded = ref({
  provider: true,
  profile: true,
  model: true
})

// Sidebar resizing
const sidebarWidth = ref(350)
const narrow = computed(() => sidebarWidth.value < 300)
const isResizing = ref(false)

// Computed
const selectedModelInfo = computed(() => {
  return availableModels.value.find(m => m.model_id === selectedModel.value)
})

// Load data on mount
onMounted(async () => {
  await loadAllData()
})

// Watch provider changes
watch(currentProvider, async (newProvider) => {
  await loadModelsForProfile()
})

// Watch profile changes
watch(selectedProfile, async (newProfile) => {
  await loadModelsForProfile()
})

// Methods
const loadAllData = async () => {
  try {
    // Load providers
    providers.value = await apiClient.getProviders()
    
    // Load profiles
    profiles.value = await apiClient.getProfiles()
    
    // Load current provider + profile
    const current = await apiClient.getCurrentProvider()
    currentProvider.value = current.provider
    selectedProfile.value = current.profile
    selectedModel.value = current.model
    
    // Load models for current profile+provider
    await loadModelsForProfile()
  } catch (error) {
    console.error('Failed to load data:', error)
    showStatus(`❌ Fehler beim Laden: ${error}`, 'error')
  }
}

const loadModelsForProfile = async () => {
  try {
    const response: ProfileModelsResponse = await apiClient.getProfileModels(
      selectedProfile.value,
      currentProvider.value
    )
    availableModels.value = response.models
    
    // Set default model if not already set
    if (availableModels.value.length > 0 && !selectedModel.value) {
      const defaultModel = availableModels.value.find(m => m.is_default)
      selectedModel.value = defaultModel?.model_id || availableModels.value[0].model_id
    }
  } catch (error) {
    console.error('Failed to load models:', error)
    availableModels.value = []
  }
}

const selectProvider = async (provider: Provider) => {
  if (provider.requires_api_key && !provider.has_api_key) {
    // Show API key dialog
    selectedProviderForKey.value = provider
    showApiKeyDialog.value = true
    apiKeyInput.value = ''
    apiKeyMessage.value = ''
    apiKeyValid.value = false
    return
  }
  
  // Validate and switch provider
  loading.value = true
  try {
    const result = await apiClient.validateProvider(provider.name)
    if (result.valid) {
      await apiClient.setProvider(provider.name)
      currentProvider.value = provider.name
      showStatus(`✅ Provider '${provider.display_name}' aktiviert`, 'success')
      // Reload everything to update provider status and models
      await loadAllData()
    } else {
      showStatus(`❌ Provider-Validierung fehlgeschlagen: ${result.message}`, 'error')
    }
  } catch (error) {
    console.error('Failed to switch provider:', error)
    showStatus(`❌ Fehler beim Wechsel: ${error}`, 'error')
  } finally {
    loading.value = false
  }
}

const testApiKey = async () => {
  if (!selectedProviderForKey.value || !apiKeyInput.value) return
  
  validating.value = true
  apiKeyMessage.value = 'Validiere API-Key...'
  
  try {
    const result = await apiClient.validateProvider(
      selectedProviderForKey.value.name,
      apiKeyInput.value
    )
    
    if (result.valid) {
      apiKeyMessage.value = `✅ ${result.message}`
      apiKeyValid.value = true
      
      // Set provider
      await apiClient.setProvider(selectedProviderForKey.value.name)
      currentProvider.value = selectedProviderForKey.value.name
      
      // Close dialog and reload
      setTimeout(async () => {
        showApiKeyDialog.value = false
        await loadAllData()
        showStatus(`✅ Provider '${selectedProviderForKey.value?.display_name}' aktiviert`, 'success')
      }, 1500)
    } else {
      apiKeyMessage.value = `❌ ${result.message}`
      apiKeyValid.value = false
    }
  } catch (error) {
    apiKeyMessage.value = `❌ Fehler: ${error}`
    apiKeyValid.value = false
  } finally {
    validating.value = false
  }
}

const cancelApiKey = () => {
  showApiKeyDialog.value = false
  apiKeyInput.value = ''
  apiKeyMessage.value = ''
}

const selectProfile = (profileName: string) => {
  selectedProfile.value = profileName
}

const applyProfile = async () => {
  loading.value = true
  try {
    await apiClient.setProfile(selectedProfile.value)
    showStatus(`✅ Profil '${selectedProfile.value}' aktiviert`, 'success')
    await loadModelsForProfile()
  } catch (error) {
    console.error('Failed to change profile:', error)
    showStatus(`❌ Fehler beim Profil-Wechsel: ${error}`, 'error')
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  loading.value = true
  try {
    // Settings are already applied when provider/profile changes
    showStatus(`✅ Einstellungen gespeichert`, 'success')
  } catch (error) {
    console.error('Failed to save settings:', error)
    showStatus(`❌ Fehler beim Speichern: ${error}`, 'error')
  } finally {
    loading.value = false
  }
}

const toggleSection = (section: 'provider' | 'profile' | 'model') => {
  expanded.value[section] = !expanded.value[section]
}

const showStatus = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  statusMessage.value = message
  statusType.value = type
  setTimeout(() => {
    statusMessage.value = ''
  }, 5000)
}

// Sidebar resizing
const startResize = (e: MouseEvent) => {
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  const newWidth = e.clientX
  if (newWidth >= 250 && newWidth <= 600) {
    sidebarWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}
</script>

<style scoped>
.settings-view {
  width: var(--sidebar-width, 350px);
  max-width: 600px;
  min-width: 250px;
  height: 100%;
  overflow-y: auto;
  padding: 2rem;
  background-color: #1a1a1a;
  color: #fff;
  position: relative;
}

h2 {
  margin-bottom: 2rem;
  font-size: 1.5rem;
}

.settings-section {
  margin-bottom: 1.5rem;
  background-color: #0a0a0a;
  border-radius: 8px;
  overflow: hidden;
}

.accordion-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  cursor: pointer;
  background-color: #2a2a2a;
  transition: background-color 0.2s;
}

.accordion-header:hover {
  background-color: #3a3a3a;
}

.accordion-header .icon {
  font-size: 0.8rem;
  color: #999;
}

.accordion-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.accordion-content {
  padding: 1rem;
}

/* Provider List */
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.provider-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.provider-item:hover:not(.disabled) {
  border-color: #646cff;
  background-color: #1a1a2a;
}

.provider-item.active {
  border-color: #646cff;
  background-color: #1a1a2a;
}

.provider-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.provider-radio input {
  cursor: pointer;
}

.provider-info {
  flex: 1;
}

.provider-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background-color: #f87171;
  color: #000;
  border-radius: 12px;
  font-weight: 600;
}

.provider-description {
  font-size: 0.875rem;
  color: #999;
}

/* API Key Dialog */
.api-key-dialog {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #2a2a2a;
  border-radius: 4px;
}

.api-key-dialog h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.api-key-input {
  width: 100%;
  padding: 0.75rem;
  background-color: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  color: #fff;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.api-key-input:focus {
  outline: none;
  border-color: #646cff;
}

.dialog-buttons {
  display: flex;
  gap: 0.5rem;
}

.api-key-message {
  margin-top: 0.75rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.api-key-message.success {
  background-color: #22c55e33;
  color: #4ade80;
}

.api-key-message.error {
  background-color: #ef444433;
  color: #f87171;
}

/* Profile List */
.profile-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.profile-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.profile-item:hover {
  border-color: #646cff;
  background-color: #1a1a2a;
}

.profile-item.active {
  border-color: #646cff;
  background-color: #1a1a2a;
}

.profile-radio input {
  cursor: pointer;
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.profile-description {
  font-size: 0.875rem;
  color: #999;
}

/* Model Selection */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group label {
  font-weight: 500;
  color: #999;
  font-size: 0.875rem;
}

.form-group select {
  padding: 0.75rem;
  background-color: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  color: #fff;
  font-size: 1rem;
}

.form-group select:focus {
  outline: none;
  border-color: #646cff;
}

.model-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background-color: #1a1a1a;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.detail-label {
  color: #999;
}

.detail-value {
  color: #fff;
  font-weight: 500;
}

.no-models {
  padding: 1rem;
  text-align: center;
  color: #999;
}

.no-models .hint {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

/* Buttons */
button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  width: 100%;
}

.btn-primary {
  background-color: #646cff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #535bf2;
}

.btn-secondary {
  background-color: #3a3a3a;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #4a4a4a;
}

.btn-success {
  background-color: #4ade80;
  color: #000;
}

.btn-success:hover:not(:disabled) {
  background-color: #22c55e;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Status Message */
.status-message {
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-top: 1rem;
}

.status-message.success {
  background-color: #22c55e33;
  color: #4ade80;
}

.status-message.error {
  background-color: #ef444433;
  color: #f87171;
}

.status-message.info {
  background-color: #3b82f633;
  color: #60a5fa;
}

/* Resize Handle */
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  background-color: #2a2a2a;
  cursor: ew-resize;
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background-color: #646cff;
}
</style>
