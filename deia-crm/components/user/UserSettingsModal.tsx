'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Lock, Bell } from 'lucide-react'
import { ProfileTab } from './ProfileTab'
import { SecurityTab } from './SecurityTab'
import { NotificationsTab } from './NotificationsTab'

type UserSettingsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserSettingsModal({ open, onOpenChange }: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configuracoes do Perfil</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Seguranca</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notificacoes</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="profile" className="m-0">
              <ProfileTab onClose={() => onOpenChange(false)} />
            </TabsContent>

            <TabsContent value="security" className="m-0">
              <SecurityTab />
            </TabsContent>

            <TabsContent value="notifications" className="m-0">
              <NotificationsTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
