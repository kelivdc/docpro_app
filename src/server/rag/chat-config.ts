// Central retrieval / generation configuration for the RAG chat pipeline.
// Single source of truth so tuning happens in one place.

export const chatConfig = {
  // Generation
  maxTokens: 2048,
  temperature: 0.1,
  stream: true,

  // Retrieval
  topK: 8, // final chunks sent to the LLM
  rerankTopK: 20, // initial candidates retrieved before reranking
  parentRetrieval: true, // expand parent/child chunks (BAB + Pasal + Ayat)
  similarityThreshold: 0.60,
}
