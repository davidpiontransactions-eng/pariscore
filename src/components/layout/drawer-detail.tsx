"use client"

import * as React from "react"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useIsMobile } from "@/hooks/use-mobile"

interface DrawerDetailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
}

function DrawerDetail({
  open,
  onOpenChange,
  children,
  title,
}: DrawerDetailProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
        {children}
      </BottomSheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export { DrawerDetail }
