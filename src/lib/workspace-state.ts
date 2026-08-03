import { useState, useEffect } from 'react'

const STORAGE_KEY = 'docpro-workspace-id'

let workspaceId = typeof window !== 'undefined'
  ? window.localStorage.getItem(STORAGE_KEY)
  : null

const listeners = new Set<(workspaceId: string | null) => void>()

function emit() {
  listeners.forEach((fn) => fn(workspaceId))
}

function persist() {
  if (typeof window !== 'undefined') {
    if (workspaceId) window.localStorage.setItem(STORAGE_KEY, workspaceId)
    else window.localStorage.removeItem(STORAGE_KEY)
  }
}

export function getWorkspaceId() {
  return workspaceId
}

export function setWorkspaceId(id: string) {
  workspaceId = id
  persist()
  emit()
}

export function useWorkspaceState() {
  const [state, setState] = useState<string | null>(workspaceId)
  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])
  return { workspaceId: state, setWorkspace: setWorkspaceId }
}
