const {contextBridge, ipcRenderer} = require('electron');
const call = (method, data) => ipcRenderer.invoke('workflow:call', method, data);
contextBridge.exposeInMainWorld('workflowDesktop', {
  version: process.argv.find(arg => arg.startsWith('--workflow-version='))?.slice('--workflow-version='.length) || '0.38.1',
  call,
  onEvent(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('workflow:event', listener);
    return () => ipcRenderer.removeListener('workflow:event', listener);
  }
});
contextBridge.exposeInMainWorld('workflowHome', {
  connectChrome: () => call('relay.pair'),
  copyChrome: () => call('relay.copy'),
  listProjects: () => call('projects.list'),
  createProject: name => call('projects.create', {name}),
  openProject: (id, view) => call('projects.open', {id, view}),
  renameProject: (id, name) => call('projects.rename', {id, name}),
  deleteProject: id => call('projects.trash', {id}),
  undoDeleteProject: id => call('projects.undoTrash', {id}),
  restoreProject: id => call('projects.restore', {id})
});
