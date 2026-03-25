import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  exportVueFile: (content: string, defaultFileName?: string) =>
    electronAPI.ipcRenderer.invoke('export-vue-file', { content, defaultFileName }),
  exportGeneratedVueFile: (content: string) =>
    electronAPI.ipcRenderer.invoke('export-generated-vue-file', { content }),
  importVueFile: () => electronAPI.ipcRenderer.invoke('import-vue-file'),
  saveDesignProject: (content: string) =>
    electronAPI.ipcRenderer.invoke('save-design-project', { content }),
  loadDesignProject: () => electronAPI.ipcRenderer.invoke('load-design-project')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
