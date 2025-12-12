import { useState, useRef, useEffect } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { recordingService } from '../services/recordingService.js';
import './RecordingTest.css';

export default function RecordingTest() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [generateLRCEnabled, setGenerateLRCEnabled] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; lrcPath?: string } | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const { uploadRecording, generateLRC, isUploading, isProcessing, error, clearError } = useAudioRecorder();

  // Solicitar permissão ao montar
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (error: any) {
        console.error('Erro ao solicitar permissão:', error);
        setHasPermission(false);
      }
    };
    requestPermission();
  }, []);

  // Timer de gravação
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (!hasPermission) {
      setTestResult({ success: false, message: 'Permissão de microfone não concedida' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const options: MediaRecorderOptions = {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4',
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Processar gravação
        await processRecording(audioBlob);
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('Erro na gravação:', event);
        setTestResult({ success: false, message: 'Erro durante a gravação' });
        setIsRecording(false);
      };

      startTimeRef.current = Date.now();
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      setTestResult(null);
      clearError();
    } catch (error: any) {
      console.error('Erro ao iniciar gravação:', error);
      setHasPermission(false);
      setTestResult({ success: false, message: 'Erro ao acessar o microfone: ' + error.message });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    try {
      setTestResult({ success: false, message: 'Enviando gravação...' });

      // Usar um songId de teste (pode ser qualquer ID válido ou criar um especial)
      const testSongId = 'test-recording';
      const startTime = 0;

      // Fazer upload
      const recordingId = await uploadRecording(audioBlob, testSongId, startTime);

      if (!recordingId) {
        setTestResult({ success: false, message: 'Erro ao fazer upload da gravação' });
        return;
      }

      // Gerar LRC apenas se o checkbox estiver marcado
      if (generateLRCEnabled) {
        setTestResult({ success: false, message: 'Gerando LRC...' });

        // Aguardar um pouco
        await new Promise(resolve => setTimeout(resolve, 500));

        // Gerar LRC
        const lrcPath = await generateLRC(testSongId, recordingId);

        if (lrcPath) {
          // Tentar ler o conteúdo do LRC
          try {
            const lrcContent = await recordingService.getRecordingLRC(testSongId, recordingId);
            const lines = lrcContent.split('\n').filter(line => line.trim()).length;
            setTestResult({
              success: true,
              message: `LRC gerado com sucesso! ${lines} linhas de letras encontradas.`,
              lrcPath: lrcPath,
            });
          } catch (err) {
            setTestResult({
              success: true,
              message: 'LRC gerado com sucesso!',
              lrcPath: lrcPath,
            });
          }
        } else {
          setTestResult({ success: false, message: 'Erro ao gerar LRC. Verifique os logs do backend.' });
        }
      } else {
        setTestResult({
          success: true,
          message: 'Gravação enviada com sucesso! LRC não foi gerado (opção desmarcada).',
        });
      }
    } catch (error: any) {
      console.error('Erro ao processar gravação:', error);
      setTestResult({ success: false, message: 'Erro: ' + error.message });
    }
  };

  return (
    <div className="recording-test">
      <div className="recording-test-header">
        <h3>🎤 Teste de Gravação e Geração de LRC</h3>
        <p className="recording-test-description">
          Use este teste para verificar se a gravação e geração de LRC estão funcionando corretamente.
          Clique em "Iniciar Gravação", fale algo, e depois clique em "Parar Gravação".
        </p>
      </div>

      {hasPermission === false && (
        <div className="recording-test-error">
          ⚠️ Permissão de microfone negada. Por favor, permita o acesso ao microfone nas configurações do navegador.
        </div>
      )}

      <div className="recording-test-options">
        <label className="recording-test-checkbox">
          <input
            type="checkbox"
            checked={generateLRCEnabled}
            onChange={(e) => setGenerateLRCEnabled(e.target.checked)}
            disabled={isRecording || isUploading || isProcessing}
          />
          <span>Gerar LRC após gravação</span>
        </label>
      </div>

      <div className="recording-test-controls">
        {!isRecording ? (
          <button
            className="recording-test-btn start-btn"
            onClick={startRecording}
            disabled={hasPermission === false || isUploading || isProcessing}
          >
            <span className="btn-icon">🎤</span>
            Iniciar Gravação
          </button>
        ) : (
          <button
            className="recording-test-btn stop-btn"
            onClick={stopRecording}
          >
            <span className="btn-icon recording">🔴</span>
            Parar Gravação
          </button>
        )}
      </div>

      {isRecording && (
        <div className="recording-test-status">
          <div className="recording-indicator">
            <span className="pulse-dot"></span>
            Gravando...
          </div>
          <div className="recording-time">{formatTime(recordingTime)}</div>
        </div>
      )}

      {(isUploading || isProcessing) && (
        <div className="recording-test-status">
          <div className="processing-indicator">
            {isUploading && '📤 Enviando gravação...'}
            {isProcessing && '🔄 Gerando LRC...'}
          </div>
        </div>
      )}

      {error && (
        <div className="recording-test-error">
          ⚠️ {error}
        </div>
      )}

      {testResult && (
        <div className={`recording-test-result ${testResult.success ? 'success' : 'error'}`}>
          <div className="result-icon">
            {testResult.success ? '✅' : '❌'}
          </div>
          <div className="result-message">{testResult.message}</div>
          {testResult.lrcPath && (
            <div className="result-details">
              <small>Caminho: {testResult.lrcPath}</small>
            </div>
          )}
        </div>
      )}

      <div className="recording-test-info">
        <h4>Como usar:</h4>
        <ol>
          <li>Marque a opção "Gerar LRC após gravação" se desejar que o LRC seja gerado</li>
          <li>Clique em "Iniciar Gravação"</li>
          <li>Fale algo (pode ser uma música, poema, ou qualquer texto)</li>
          <li>Clique em "Parar Gravação"</li>
          <li>Aguarde o processamento (upload e, se marcado, geração de LRC)</li>
          <li>Veja o resultado abaixo</li>
        </ol>
        <p className="info-note">
          <strong>Nota:</strong> O arquivo será salvo em <code>music/test-recording/recordings/</code>
        </p>
      </div>
    </div>
  );
}
