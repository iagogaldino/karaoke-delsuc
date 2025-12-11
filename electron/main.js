const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

// ============================================
// OTIMIZAÇÕES DE PERFORMANCE DO ELECTRON
// ============================================

// Desabilitar throttling de processamento quando em background
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Otimizações de GPU e hardware acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Otimizações de memória
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
// disable-dev-shm-usage é específico do Linux, verificar plataforma
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-dev-shm-usage'); // Evitar problemas de memória compartilhada no Linux
}

// Otimizações de rede e streaming
app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess');

// Otimizações de áudio/vídeo
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// UseChromeOSDirectVideoDecoder é específico do ChromeOS
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
}

// Desabilitar recursos desnecessários para melhor performance
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-plugins-discovery');
app.commandLine.appendSwitch('disable-default-apps');

// Otimizações de renderização
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('enable-accelerated-video-decode');

// Limitar processos de renderização (1 processo = melhor performance para app single-window)
app.commandLine.appendSwitch('process-per-site');

// Desabilitar logs desnecessários em produção
if (app.isPackaged) {
  app.commandLine.appendSwitch('disable-logging');
  app.commandLine.appendSwitch('silent');
}

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
      offscreen: false,
      // Otimizações de performance
      enableWebSQL: false, // Desabilitar WebSQL (não usado)
      enableRemoteModule: false, // Desabilitar módulo remoto (segurança + performance)
      spellcheck: false, // Desabilitar spellcheck (economiza recursos)
      // Otimizações de renderização
      enableBlinkFeatures: 'CSSColorSchemeUARendering',
      disableBlinkFeatures: 'Auxclick'
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
    
    // Otimizações adicionais após a janela estar pronta
    if (!isDev) {
      // Focar na janela para garantir melhor performance
      mainWindow.focus();
    }
  });

  // Otimizar performance quando a janela ganha foco
  mainWindow.on('focus', () => {
    // Garantir que a janela tenha prioridade de processamento
    mainWindow.webContents.setFrameRate(60); // 60 FPS para melhor fluidez
  });

  // Reduzir frame rate quando em background para economizar recursos
  mainWindow.on('blur', () => {
    mainWindow.webContents.setFrameRate(30); // Reduzir para 30 FPS quando não está em foco
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
  // Configurar limites de recursos
  app.setAppUserModelId('com.karaoke.app');
  
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

