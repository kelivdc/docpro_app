import { useState, useEffect } from 'react'

const STORAGE_KEY = 'docpro-sidebar-collapsed'

let collapsed = false

const listeners = new Set<(collapsed: boolean) => void>()

function emit() {
  listeners.forEach((fn) => fn(collapsed))
}

function persist() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed))
  }
}

export function getSidebarCollapsed() {
  return collapsed
}

export function toggleSidebar() {
  collapsed = !collapsed
  persist()
  emit()
}

export function useSidebarState() {
  const [state, setState] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY) === 'true'
      if (stored !== collapsed) {
        collapsed = stored
        setState(stored)
      }
    }
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  return { collapsed: state, toggle: toggleSidebar }
}
