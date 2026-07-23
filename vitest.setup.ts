// Test environment setup: force the deterministic local embedding fallback so
// retrieval tests don't depend on the external Ollama embedding server (which
// can be slow/flaky and would make stored vs queried vectors inconsistent).
// The running app still uses EMBEDDING_URL from .env.local for real embeddings.
delete process.env.EMBEDDING_URL
