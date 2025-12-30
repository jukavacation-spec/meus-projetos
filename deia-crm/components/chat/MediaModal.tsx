'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2
} from 'lucide-react'
import { cn } from '@/lib/utils'

type MediaItem = {
  id: number
  file_type: 'image' | 'audio' | 'video' | 'file' | 'location'
  data_url: string
  thumb_url?: string | null
}

type MediaModalProps = {
  media: MediaItem | null
  allMedia?: MediaItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MediaModal({ media, allMedia = [], open, onOpenChange }: MediaModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Find current media index
  useEffect(() => {
    if (media && allMedia.length > 0) {
      const index = allMedia.findIndex(m => m.id === media.id)
      if (index !== -1) setCurrentIndex(index)
    }
  }, [media, allMedia])

  // Reset zoom and rotation when media changes
  useEffect(() => {
    setZoom(1)
    setRotation(0)
  }, [currentIndex])

  const currentMedia = allMedia.length > 0 ? allMedia[currentIndex] : media

  const handlePrevious = useCallback(() => {
    if (allMedia.length > 1) {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : allMedia.length - 1))
    }
  }, [allMedia.length])

  const handleNext = useCallback(() => {
    if (allMedia.length > 1) {
      setCurrentIndex(prev => (prev < allMedia.length - 1 ? prev + 1 : 0))
    }
  }, [allMedia.length])

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  const handleDownload = () => {
    if (!currentMedia) return
    const link = document.createElement('a')
    link.href = currentMedia.data_url
    link.download = `media-${currentMedia.id}.${currentMedia.file_type === 'image' ? 'jpg' : 'mp4'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return

      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious()
          break
        case 'ArrowRight':
          handleNext()
          break
        case 'Escape':
          onOpenChange(false)
          break
        case '+':
        case '=':
          handleZoomIn()
          break
        case '-':
          handleZoomOut()
          break
        case 'r':
          handleRotate()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handlePrevious, handleNext, onOpenChange])

  if (!currentMedia) return null

  const imageMedia = allMedia.filter(m => m.file_type === 'image' || m.file_type === 'video')
  const showNavigation = imageMedia.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none overflow-hidden">
        {/* Top toolbar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            {showNavigation && (
              <span className="text-white/80 text-sm">
                {currentIndex + 1} / {imageMedia.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {currentMedia.file_type === 'image' && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-5 w-5" />
                </Button>
                <span className="text-white/80 text-sm min-w-[3rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleRotate}
                >
                  <RotateCw className="h-5 w-5" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleDownload}
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex items-center justify-center min-h-[80vh] p-12">
          {currentMedia.file_type === 'image' && (
            <img
              src={currentMedia.data_url}
              alt="Media"
              className="max-w-full max-h-[80vh] object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
              draggable={false}
            />
          )}

          {currentMedia.file_type === 'video' && (
            <video
              src={currentMedia.data_url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh]"
            />
          )}

          {currentMedia.file_type === 'audio' && (
            <div className="bg-white/10 rounded-lg p-8">
              <audio
                src={currentMedia.data_url}
                controls
                autoPlay
                className="min-w-[300px]"
              />
            </div>
          )}
        </div>

        {/* Navigation arrows */}
        {showNavigation && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12",
                "text-white hover:bg-white/20 bg-black/30"
              )}
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12",
                "text-white hover:bg-white/20 bg-black/30"
              )}
              onClick={handleNext}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </>
        )}

        {/* Thumbnail strip */}
        {showNavigation && imageMedia.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <div className="flex items-center justify-center gap-2 overflow-x-auto">
              {imageMedia.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setCurrentIndex(allMedia.findIndex(am => am.id === m.id))}
                  className={cn(
                    "relative h-12 w-12 rounded overflow-hidden transition-all shrink-0",
                    currentMedia.id === m.id
                      ? "ring-2 ring-white scale-110"
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  {m.file_type === 'image' ? (
                    <img
                      src={m.thumb_url || m.data_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-white/20 flex items-center justify-center">
                      <span className="text-xs text-white">Video</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Keyboard hints */}
        <div className="absolute bottom-4 right-4 text-white/40 text-xs hidden lg:block">
          ← → Navegar • +/- Zoom • R Rotacionar • Esc Fechar
        </div>
      </DialogContent>
    </Dialog>
  )
}
