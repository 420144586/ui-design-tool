import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import linuxIcon from '../../resources/icon.png?asset'

/** 与 electron-builder 的 icon/extraResources 一致：开发用仓库 icon，打包后用 resources/favicon.ico */
const getWindowIcon = (): string | undefined => {
  if (process.platform === 'darwin') return undefined
  if (is.dev) {
    return join(__dirname, '../../icon/favicon.ico')
  }
  return join(process.resourcesPath, 'favicon.ico')
}

/** 设计稿默认目录（与安装位置无关） */
const getDesignSavesDir = (): string => join(app.getPath('userData'), 'design-saves')

/** 生成预览用 .vue 写入此目录，打包后仍可读写 */
const getPreviewGeneratedDir = (): string => join(app.getPath('userData'), 'deesign-preview')

function createWindow(): void {
  const iconPath = getWindowIcon()
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: linuxIcon } : iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.deesign.app')

  const userDataPath = app.getPath('userData')
  console.log('[deesign] userData:', userDataPath)

  const previewDir = getPreviewGeneratedDir()
  const designSavesDir = getDesignSavesDir()
  await mkdir(previewDir, { recursive: true }).catch((e) =>
    console.error('[deesign] 创建预览目录失败:', previewDir, e)
  )
  await mkdir(designSavesDir, { recursive: true }).catch((e) =>
    console.error('[deesign] 创建设计稿目录失败:', designSavesDir, e)
  )
  console.log('[deesign] preview dir:', previewDir)
  console.log('[deesign] saves dir:', designSavesDir)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.removeHandler('export-vue-file')
  ipcMain.removeHandler('export-generated-vue-file')
  ipcMain.removeHandler('import-vue-file')
  ipcMain.removeHandler('save-design-project')
  ipcMain.removeHandler('load-design-project')
  ipcMain.removeHandler('read-generated-preview')
  ipcMain.removeHandler('get-preview-dir')
  ipcMain.handle('export-vue-file', async (_, payload: { content: string; defaultFileName?: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 Vue 文件',
      defaultPath: payload.defaultFileName ?? 'generated-component.vue',
      filters: [{ name: 'Vue 文件', extensions: ['vue'] }]
    })

    if (canceled || !filePath) {
      return { ok: false, canceled: true }
    }

    await writeFile(filePath, payload.content, 'utf-8')
    return { ok: true, canceled: false, filePath }
  })
  ipcMain.handle('get-preview-dir', () => {
    return { userDataPath: app.getPath('userData'), previewDir: getPreviewGeneratedDir() }
  })
  ipcMain.handle('export-generated-vue-file', async (_, payload: { content: string }) => {
    const generatedDir = getPreviewGeneratedDir()
    const targetFilePath = join(generatedDir, 'preview.html')
    await mkdir(generatedDir, { recursive: true })
    await writeFile(targetFilePath, payload.content, 'utf-8')
    console.log('[deesign] 预览文件已写入:', targetFilePath, `(${payload.content.length} bytes)`)
    return { ok: true, filePath: targetFilePath }
  })
  ipcMain.handle('read-generated-preview', async () => {
    const targetFilePath = join(getPreviewGeneratedDir(), 'preview.html')
    try {
      const content = await readFile(targetFilePath, 'utf-8')
      console.log('[deesign] 预览文件已读取:', targetFilePath, `(${content.length} bytes)`)
      return { ok: true, content, filePath: targetFilePath }
    } catch (e) {
      console.warn('[deesign] 预览文件读取失败:', targetFilePath, e)
      return { ok: false, content: '', filePath: targetFilePath }
    }
  })
  ipcMain.handle('import-vue-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '导入 Vue 文件',
      properties: ['openFile'],
      filters: [{ name: 'Vue 文件', extensions: ['vue'] }]
    })

    if (canceled || filePaths.length === 0) {
      return { ok: false, canceled: true }
    }

    const filePath = filePaths[0]
    const content = await readFile(filePath, 'utf-8')
    return { ok: true, canceled: false, filePath, content }
  })

  ipcMain.handle('save-design-project', async (_, payload: { content: string; filePath?: string }) => {
    const designSavesDir = getDesignSavesDir()
    await mkdir(designSavesDir, { recursive: true })
    
    let targetPath = payload.filePath
    if (!targetPath) {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: '保存设计稿',
        defaultPath: join(designSavesDir, '未命名.design.json'),
        filters: [{ name: '设计稿 JSON', extensions: ['json'] }]
      })
      if (canceled || !filePath) return { canceled: true }
      targetPath = filePath
    }

    await writeFile(targetPath, payload.content, 'utf-8')
    return { canceled: false, filePath: targetPath }
  })

  ipcMain.handle('load-design-project', async () => {
    const designSavesDir = getDesignSavesDir()
    await mkdir(designSavesDir, { recursive: true })
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '读取设计稿',
      defaultPath: designSavesDir,
      properties: ['openFile'],
      filters: [{ name: '设计稿 JSON', extensions: ['json'] }]
    })
    if (canceled || !filePaths?.length) return { canceled: true }
    const filePath = filePaths[0]
    const content = await readFile(filePath, 'utf-8')
    return { canceled: false, filePath, content }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
