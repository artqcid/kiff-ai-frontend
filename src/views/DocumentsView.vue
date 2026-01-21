<template>
  <div class="documents-view">
    <h2>📄 Dokumente</h2>

    <!-- Upload Section -->
    <div class="upload-section">
      <h3>📤 Upload</h3>
      <div class="upload-controls">
        <input type="file" @change="handleFileUpload" ref="fileInput" />
        <button @click="uploadFile" :disabled="!selectedFile || uploading" class="btn-primary">
          {{ uploading ? '⏳ Uploading...' : '📤 Upload Document' }}
        </button>
      </div>
      <p v-if="uploadMessage" class="upload-message">{{ uploadMessage }}</p>
    </div>

    <!-- Input Documents -->
    <div class="documents-section">
      <div class="section-header">
        <h3>📥 Input Documents</h3>
        <button @click="loadDocuments" class="btn-secondary">🔄 Refresh</button>
      </div>
      <div v-if="inputDocs.length === 0" class="empty-state">
        Keine Input-Dokumente vorhanden
      </div>
      <div v-else class="documents-grid">
        <div v-for="doc in inputDocs" :key="doc.filename" class="document-card">
          <div class="document-icon">📄</div>
          <div class="document-info">
            <div class="document-name">{{ doc.filename }}</div>
            <div class="document-meta">{{ formatSize(doc.size) }}</div>
          </div>
          <button @click="deleteDoc(doc.filename)" class="btn-delete">🗑️</button>
        </div>
      </div>
    </div>

    <!-- Output Documents -->
    <div class="documents-section">
      <div class="section-header">
        <h3>📤 Output Documents</h3>
      </div>
      <div v-if="outputDocs.length === 0" class="empty-state">
        Keine Output-Dokumente vorhanden
      </div>
      <div v-else class="documents-grid">
        <div v-for="doc in outputDocs" :key="doc.filename" class="document-card">
          <div class="document-icon">📄</div>
          <div class="document-info">
            <div class="document-name">{{ doc.filename }}</div>
            <div class="document-meta">{{ formatSize(doc.size) }}</div>
          </div>
          <button @click="deleteDoc(doc.filename)" class="btn-delete">🗑️</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiClient, type DocumentInfo } from '../api/client'

const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const uploadMessage = ref('')
const documents = ref<DocumentInfo[]>([])

const inputDocs = computed(() => 
  documents.value.filter(doc => doc.type === 'input')
)

const outputDocs = computed(() => 
  documents.value.filter(doc => doc.type === 'output')
)

onMounted(async () => {
  await loadDocuments()
})

const loadDocuments = async () => {
  try {
    documents.value = await apiClient.getDocuments()
  } catch (error) {
    console.error('Failed to load documents:', error)
    uploadMessage.value = `❌ Fehler beim Laden: ${error}`
  }
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0] || null
    uploadMessage.value = ''
  }
}

const uploadFile = async () => {
  if (!selectedFile.value) return
  
  uploading.value = true
  uploadMessage.value = 'Uploading...'
  try {
    await apiClient.uploadDocument(selectedFile.value)
    uploadMessage.value = '✅ Document uploaded successfully!'
    selectedFile.value = null
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    await loadDocuments()
  } catch (error) {
    console.error('Upload error:', error)
    uploadMessage.value = `❌ Failed to upload: ${error}`
  } finally {
    uploading.value = false
    setTimeout(() => uploadMessage.value = '', 3000)
  }
}

const deleteDoc = async (filename: string) => {
  if (!confirm(`Dokument "${filename}" wirklich löschen?`)) return
  
  try {
    await apiClient.deleteDocument(filename)
    uploadMessage.value = `✅ ${filename} gelöscht`
    await loadDocuments()
  } catch (error) {
    console.error('Delete error:', error)
    uploadMessage.value = `❌ Fehler beim Löschen: ${error}`
  } finally {
    setTimeout(() => uploadMessage.value = '', 3000)
  }
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.documents-view {
  max-width: 1000px;
}

h2 {
  margin-bottom: 2rem;
}

.upload-section {
  padding: 1.5rem;
  background-color: #1a1a1a;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.upload-section h3 {
  margin-bottom: 1rem;
  color: #646cff;
}

.upload-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}

.upload-message {
  padding: 0.75rem;
  background-color: #0a0a0a;
  border-radius: 4px;
  color: #ffa500;
}

.documents-section {
  padding: 1.5rem;
  background-color: #1a1a1a;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  color: #646cff;
  margin: 0;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #666;
  background-color: #0a0a0a;
  border-radius: 4px;
}

.documents-grid {
  display: grid;
  gap: 1rem;
}

.document-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: #0a0a0a;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.document-card:hover {
  background-color: #1a1a1a;
}

.document-icon {
  font-size: 2rem;
}

.document-info {
  flex: 1;
}

.document-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.document-meta {
  font-size: 0.875rem;
  color: #666;
}

input[type="file"] {
  flex: 1;
  padding: 0.5rem;
  background-color: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  color: #fff;
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

.btn-delete {
  background-color: transparent;
  color: #f87171;
  padding: 0.5rem;
  font-size: 1rem;
}

.btn-delete:hover {
  background-color: rgba(248, 113, 113, 0.1);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
