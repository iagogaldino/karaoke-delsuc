import { useEffect, useRef, useState } from 'react';
import './AudioRecorder.css';

interface AudioRecorderProps {
  isPlaying: boolean;
  songId: string | null;
  currentTime: number;
  onRecordingComplete?: (audioBlob: Blob, startTime: number) => void;
  onError?: (error: string) => void;
}

export default function AudioRecorder({
  isPlaying,
  songId,
  currentTime,
  onRecordingComplete,
  onError,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const isStartingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const recordingStartTimestampRef = useRef<number>(0);
  const isStoppedRef = useRef<boolean>(false);
  const lastStopTimestampRef = useRef<number>(0);
  const lastIsPlayingRef = useRef<boolean>(false);

  // Solicitar permissão de microfone ao montar
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Liberar stream imediatamente após verificar permissão
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (error: any) {
        console.error('Erro ao solicitar permissão de microfone:', error);
        setHasPermission(false);
        if (onError) {
          onError('Permissão de microfone negada. Por favor, permita o acesso ao microfone.');
        }
      }
    };

    requestPermission();
  }, [onError]);

  // Iniciar/parar gravação baseado no estado de reprodução
  useEffect(() => {
    if (!hasPermission || !songId) {
      return;
    }

    const startRecording = async () => {
      // Evitar iniciar se já está iniciando ou gravando
      if (isStartingRef.current || isRecording || mediaRecorderRef.current?.state === 'recording') {
        console.log('⏭️ Ignorando início de gravação (já está iniciando ou gravando)');
        return;
      }

      // Evitar iniciar se acabou de parar (aguardar pelo menos 1 segundo)
      const timeSinceLastStop = Date.now() - lastStopTimestampRef.current;
      if (timeSinceLastStop < 1000 && lastStopTimestampRef.current > 0) {
        console.log(`⏭️ Ignorando início de gravação (acabou de parar há ${timeSinceLastStop}ms)`);
        return;
      }

      isStartingRef.current = true;
      
      try {
        // Limpar qualquer gravação anterior que possa estar pendente
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try {
            mediaRecorderRef.current.stop();
          } catch (err) {
            // Ignorar erros ao parar gravação anterior
          }
        }
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        streamRef.current = stream;

        // Verificar se MediaRecorder é suportado
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          console.warn('WebM não suportado, tentando outros formatos...');
        }

        // Criar MediaRecorder
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
        
        // IMPORTANTE: Resetar isStoppedRef ANTES de configurar os handlers
        isStoppedRef.current = false;

        mediaRecorder.ondataavailable = (event) => {
          console.log(`📥 ondataavailable chamado: size=${event.data?.size || 0}, isStopped=${isStoppedRef.current}, state=${mediaRecorder.state}`);
          // Processar chunks se tiver dados, mesmo que já tenha parado (pode ser chunk final)
          if (event.data && event.data.size > 0) {
            // Só ignorar se explicitamente marcado como parado E já tiver chunks (para evitar chunks duplicados após parar)
            if (!isStoppedRef.current || chunksRef.current.length === 0) {
              chunksRef.current.push(event.data);
              console.log(`📦 Chunk recebido: ${(event.data.size / 1024).toFixed(2)} KB (total: ${chunksRef.current.length})`);
            } else {
              console.log(`⏭️ Chunk ignorado (já parado e tem chunks): isStopped=${isStoppedRef.current}, size=${event.data?.size || 0}`);
            }
          } else {
            console.log(`⏭️ Chunk vazio ignorado: size=${event.data?.size || 0}`);
          }
        };

        mediaRecorder.onstop = () => {
          console.log(`🛑 onstop chamado. Chunks coletados até agora: ${chunksRef.current.length}`);
          
          // NÃO marcar como parado ainda - aguardar processar os chunks primeiro
          // isStoppedRef.current = true; // Movido para depois de processar
          setIsRecording(false);
          lastStopTimestampRef.current = Date.now(); // Registrar quando parou
          
          // Aguardar um pouco mais para garantir que todos os chunks foram coletados
          setTimeout(() => {
            console.log(`⏱️ Após timeout, chunks coletados: ${chunksRef.current.length}`);
            
            // AGORA marcar como parado para evitar mais chunks
            isStoppedRef.current = true;
            
            // Parar todas as tracks do stream após coletar chunks
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
            }
            
            // Verificar se há chunks coletados
            if (chunksRef.current.length === 0) {
              console.warn('⚠️ Nenhum chunk de áudio foi coletado');
              // Não chamar onError aqui para evitar múltiplos erros
              // Apenas limpar e retornar
              chunksRef.current = [];
              mediaRecorderRef.current = null;
              return;
            }

            const audioBlob = new Blob(chunksRef.current, {
              type: mediaRecorder.mimeType || 'audio/webm',
            });

            // Verificar se o blob tem tamanho válido
            if (audioBlob.size === 0) {
              console.error('⚠️ Blob de áudio está vazio (chunks coletados mas blob vazio)');
              console.error(`   Chunks: ${chunksRef.current.length}, Tamanhos: ${chunksRef.current.map(c => c.size).join(', ')}`);
              chunksRef.current = [];
              
              // Parar todas as tracks do stream
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
              }
              mediaRecorderRef.current = null;
              return;
            }

            console.log(`✅ Gravação finalizada: ${(audioBlob.size / 1024).toFixed(2)} KB, tipo: ${audioBlob.type}`);
            console.log(`   Chunks coletados: ${chunksRef.current.length}`);

            // Parar todas as tracks do stream
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
            }

            // Limpar referência do MediaRecorder
            mediaRecorderRef.current = null;

            // Chamar callback com o blob e o tempo de início
            if (onRecordingComplete) {
              onRecordingComplete(audioBlob, recordingStartTimeRef.current);
            }

            chunksRef.current = [];
          }, 500); // Aumentado para 500ms para garantir que todos os chunks foram processados
        };

        mediaRecorder.onerror = (event: any) => {
          console.error('Erro na gravação:', event);
          isStartingRef.current = false;
          setIsRecording(false);
          if (onError) {
            onError('Erro durante a gravação de áudio');
          }
        };

        // Iniciar gravação
        // Usar currentTime apenas quando realmente iniciar, não como dependência do effect
        recordingStartTimeRef.current = currentTime;
        startTimeRef.current = Date.now();
        recordingStartTimestampRef.current = Date.now();
        // isStoppedRef já foi resetado acima, antes de configurar handlers
        
        // Coletar dados com frequência menor para garantir que há dados quando parar
        // Usar 100ms para ter mais chunks e garantir que há dados mesmo em gravações curtas
        mediaRecorder.start(100); // Coletar dados a cada 100ms
        
        setIsRecording(true);
        isStartingRef.current = false;

        console.log(`🎤 Gravação iniciada (state: ${mediaRecorder.state}, mimeType: ${mediaRecorder.mimeType})`);
        
        // Verificar se está realmente gravando após um pequeno delay
        setTimeout(() => {
          console.log(`🔍 Verificação após 200ms: state=${mediaRecorderRef.current?.state}, chunks=${chunksRef.current.length}`);
        }, 200);
      } catch (error: any) {
        console.error('Erro ao iniciar gravação:', error);
        isStartingRef.current = false;
        setIsRecording(false);
        setHasPermission(false);
        if (onError) {
          onError('Erro ao acessar o microfone: ' + error.message);
        }
      }
    };

    const stopRecording = () => {
      // Evitar parar múltiplas vezes
      if (isStoppingRef.current) {
        console.log('⏭️ Ignorando parada de gravação (já está parando)');
        return;
      }

      if (!isRecording && mediaRecorderRef.current?.state !== 'recording') {
        console.log('⏭️ Ignorando parada (não está gravando)');
        return;
      }

      if (mediaRecorderRef.current) {
        // Verificar o estado do MediaRecorder antes de parar
        if (mediaRecorderRef.current.state === 'recording') {
          // Verificar se a gravação teve tempo mínimo (pelo menos 500ms)
          const recordingDuration = Date.now() - recordingStartTimestampRef.current;
          if (recordingDuration < 500) {
            console.log(`⏳ Aguardando tempo mínimo de gravação (${recordingDuration}ms < 500ms)...`);
            // Aguardar até ter pelo menos 500ms de gravação
            setTimeout(() => {
              stopRecording();
            }, 500 - recordingDuration);
            return;
          }

          isStoppingRef.current = true;
          
          // Solicitar dados finais antes de parar
          try {
            mediaRecorderRef.current.requestData();
          } catch (err) {
            console.warn('Erro ao solicitar dados finais:', err);
          }
          
          // Aguardar um pouco antes de parar para garantir que os dados foram solicitados
          setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
              setIsRecording(false);
              isStoppingRef.current = false;
              console.log('🛑 Gravação parada');
            } else {
              isStoppingRef.current = false;
              setIsRecording(false);
            }
          }, 200);
        } else if (mediaRecorderRef.current.state === 'paused') {
          // Se estiver pausado, apenas parar
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          isStoppingRef.current = false;
          console.log('🛑 Gravação parada (estava pausada)');
        } else {
          setIsRecording(false);
          isStoppingRef.current = false;
          console.log('🛑 Gravação já estava parada');
        }
      } else {
        setIsRecording(false);
        isStoppingRef.current = false;
      }
    };

    // Só iniciar/parar se realmente mudou o estado de isPlaying
    const isPlayingChanged = isPlaying !== lastIsPlayingRef.current;
    
    console.log(`🔍 Estado: isPlaying=${isPlaying}, isPlayingChanged=${isPlayingChanged}, isRecording=${isRecording}, state=${mediaRecorderRef.current?.state}`);
    
    if (isPlayingChanged) {
      console.log(`🔄 Mudança detectada: isPlaying mudou de ${lastIsPlayingRef.current} para ${isPlaying}`);
      lastIsPlayingRef.current = isPlaying;
      
      if (isPlaying && !isRecording && !isStartingRef.current) {
        console.log(`▶️ Iniciando gravação...`);
        startRecording();
      } else if (!isPlaying && (isRecording || mediaRecorderRef.current?.state === 'recording')) {
        console.log(`⏸️ Parando gravação...`);
        stopRecording();
      }
    } else {
      // Atualizar referência mesmo se não mudou, para manter sincronizado
      lastIsPlayingRef.current = isPlaying;
    }

    // Cleanup ao desmontar ou mudar música
    return () => {
      console.log(`🧹 Cleanup executado: isPlaying=${isPlaying}, isRecording=${isRecording}, state=${mediaRecorderRef.current?.state}`);
      
      // NÃO parar a gravação no cleanup se isPlaying ainda está true
      // Isso pode causar problemas se o effect for re-executado rapidamente
      if (!isPlaying) {
        // Só limpar se realmente não está mais tocando
        isStartingRef.current = false;
        isStoppingRef.current = false;
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try {
            // Parar gravação se estiver ativa
            if (mediaRecorderRef.current.state === 'recording') {
              console.log(`🧹 Parando gravação no cleanup (isPlaying=false)`);
              mediaRecorderRef.current.stop();
            }
          } catch (err) {
            // Ignorar erros no cleanup
          }
        }
      } else {
        // Se ainda está tocando, apenas resetar flags, mas não parar a gravação
        console.log(`🧹 Cleanup ignorado (isPlaying ainda está true)`);
        isStartingRef.current = false;
        isStoppingRef.current = false;
      }
    };
  }, [isPlaying, songId, hasPermission, onRecordingComplete, onError]);

  // Parar gravação quando música mudar
  useEffect(() => {
    if (mediaRecorderRef.current && isRecording && songId) {
      // Se a música mudou, parar gravação anterior
      const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      };
      return stopRecording;
    }
  }, [songId, isRecording]);

  // Não renderizar nada, apenas gerenciar gravação em background
  return null;
}
