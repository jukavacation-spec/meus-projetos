'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react'

type AudioRecorderProps = {
  onSend: (audioBlob: Blob) => Promise<void>
  disabled?: boolean
}

export function AudioRecorder({ onSend, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Formatar tempo (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Iniciar gravação
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
      }

      mediaRecorder.start(100) // Coletar dados a cada 100ms
      setIsRecording(true)
      setRecordingTime(0)

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch {
      alert('Não foi possível acessar o microfone. Verifique as permissões.')
    }
  }, [])

  // Parar gravação
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      // Parar stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [isRecording])

  // Cancelar gravação
  const cancelRecording = useCallback(() => {
    stopRecording()
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
  }, [stopRecording])

  // Enviar áudio
  const sendAudio = useCallback(async () => {
    if (!audioBlob) return

    setIsSending(true)
    try {
      await onSend(audioBlob)
      // Limpar estado após envio
      setAudioBlob(null)
      setAudioUrl(null)
      setRecordingTime(0)
    } catch {
      // Error handled silently
    } finally {
      setIsSending(false)
    }
  }, [audioBlob, onSend])

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  // Se tem áudio gravado, mostrar player e opções
  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <audio src={audioUrl} controls className="h-8 flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          className="text-destructive shrink-0"
          title="Descartar"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          onClick={sendAudio}
          disabled={isSending}
          className="shrink-0"
          title="Enviar"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    )
  }

  // Se está gravando, mostrar controles de gravação
  if (isRecording) {
    return (
      <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-950 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            {formatTime(recordingTime)}
          </span>
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          className="text-destructive shrink-0"
          title="Cancelar"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={stopRecording}
          className="bg-red-500 hover:bg-red-600 shrink-0"
          title="Parar"
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Estado inicial - botão de gravar
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startRecording}
      disabled={disabled}
      className="text-muted-foreground shrink-0"
      title="Gravar áudio"
    >
      <Mic className="h-5 w-5" />
    </Button>
  )
}
