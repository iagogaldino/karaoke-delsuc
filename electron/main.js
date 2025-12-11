const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
  // Criar a janela do navegador
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Desabilitado para melhorar streaming de áudio no Electron
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      // Otimizações para streaming de mídia
      backgroundThrottling: false, // Evitar throttling quando em background
      offscreen: false
    },
    icon: path.join(__dirname, '../assets/icon.png'), // Opcional: ícone da aplicação
    autoHideMenuBar: true, // Esconder barra de menu por padrão
    fullscreen: false, // Começar em modo janela
    show: false // Não mostrar até estar pronto
  });

  // Carregar a interface
  // Em desenvolvimento: carregar do servidor Vite
  // Em produção: carregar do build estático
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Abrir DevTools em desenvolvimento
    mainWindow.webContents.openDevTools();
  } else {
    // Em produção, carregar do build
    mainWindow.loadFile(path.join(__dirname, '../interface/dist/index.html'));
  }

  // Mostrar janela quando estiver pronto
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Fechar quando a janela for fechada
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Criar menu customizado
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Sair',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'forceReload', label: 'Forçar Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas do Desenvolvedor' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom Normal' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startBackend() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const backendPath = path.join(__dirname, '../backend');
  
  // Detectar o sistema operacional
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  
  if (isDev) {
    // Em desenvolvimento, iniciar backend com tsx watch
    backendProcess = spawn(npmCmd, ['run', 'dev'], {
      cwd: backendPath,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env }
    });
  } else {
    // Em produção, iniciar backend compilado
    backendProcess = spawn(npmCmd, ['start'], {
      cwd: backendPath,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env }
    });
  }

  backendProcess.on('error', (error) => {
    console.error('Erro ao iniciar backend:', error);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend encerrado com código ${code}`);
  });
}

// Este método será chamado quando o Electron terminar de inicializar
app.whenReady().then(() => {
  // Iniciar backend primeiro
  startBackend();
  
  // Aguardar um pouco para o backend iniciar
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on('activate', () => {
    // No macOS, é comum recriar uma janela quando o ícone do dock é clicado
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Sair quando todas as janelas forem fechadas, exceto no macOS
app.on('window-all-closed', () => {
  // Matar o processo do backend
  if (backendProcess) {
    backendProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Encerrar processos ao sair
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

