<template>
  <div class="documents-view">
    <h2>Documents</h2>
    <div class="upload-section">
      <input type="file" @change="handleFileUpload" ref="fileInput" />
      <button @click="uploadFile" :disabled="!selectedFile || uploading">
        {{ uploading ? 'Uploading...' : 'Upload Document' }}
      </button>
    </div>
    <div class="documents-list">
      <h3>Uploaded Documents</h3>
      <p>Document list coming soon...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { apiClient } from '../api/client'

const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const uploading = ref(false)

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const uploadFile = async () => {
  if (!selectedFile.value) return
  
  uploading.value = true
  try {
    await apiClient.uploadDocument(selectedFile.value)
    alert('Document uploaded successfully!')
    selectedFile.value = null
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  } catch (error) {
    console.error('Upload error:', error)
    alert('Failed to upload document')
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.documents-view {
  max-width: 800px;
}

h2 {
  margin-bottom: 2rem;
}

.upload-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background-color: #1a1a1a;
  border-radius: 8px;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.documents-list {
  padding: 1.5rem;
  background-color: #1a1a1a;
  border-radius: 8px;
}

h3 {
  margin-bottom: 1rem;
}
</style>
