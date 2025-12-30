'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Smile } from 'lucide-react'

// Importar dinamicamente para evitar SSR issues
const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => (
    <div className="w-[350px] h-[400px] flex items-center justify-center">
      <span className="text-muted-foreground">Carregando...</span>
    </div>
  )
})

type EmojiPickerPopoverProps = {
  onSelect: (emoji: string) => void
  disabled?: boolean
}

export function EmojiPickerPopover({ onSelect, disabled }: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false)

  const handleEmojiClick = (emojiData: { emoji: string }) => {
    onSelect(emojiData.emoji)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground shrink-0"
          disabled={disabled}
          title="Emojis"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-none"
        align="start"
        side="top"
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          width={350}
          height={400}
          searchPlaceholder="Buscar emoji..."
          previewConfig={{ showPreview: false }}
        />
      </PopoverContent>
    </Popover>
  )
}
