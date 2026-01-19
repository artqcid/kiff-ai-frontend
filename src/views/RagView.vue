<template>
  <div class="rag-view">
    <h2>🔍 RAG (Retrieval-Augmented Generation)</h2>
    <div class="info-box">
      <p>
        <strong>RAG</strong> wird in einer späteren Version implementiert.
      </p>
      <p>Geplante Features:</p>
      <ul>
        <li>Qdrant Vector Database Integration</li>
        <li>Dokument-Indexierung und Chunking</li>
        <li>Semantic Search über Wissensdatenbank</li>
        <li>Context-Enrichment für Chat</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.rag-view {
  max-width: 800px;
}

h2 {
  margin-bottom: 2rem;
}

.info-box {
  padding: 2rem;
  background-color: #1a1a1a;
  border-radius: 8px;
  border-left: 4px solid #646cff;
}

.info-box p {
  margin-bottom: 1rem;
  line-height: 1.6;
}

.info-box ul {
  margin-left: 1.5rem;
  line-height: 1.8;
}

.info-box li {
  color: #999;
}
</style>
