const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  fetchJiraEpics: (opts) => ipcRenderer.invoke('jira:fetchEpics', opts),
  getJiraSites: () => ipcRenderer.invoke('jira:getSites'),

  getSession: () => ipcRenderer.invoke('auth:getSession'),
  getAuthProviders: () => ipcRenderer.invoke('auth:providers'),
  signIn: (provider, credentials) => ipcRenderer.invoke('auth:signin', { provider, credentials }),
  signOut: () => ipcRenderer.invoke('auth:signout')
});
