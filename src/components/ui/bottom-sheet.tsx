"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Drawer as DrawerPrimitive } from "vaul"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
  className?: string
}

function BottomSheet({
  open,
  onOpenChange,
  children,
  title,
  className,
}: BottomSheetProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DrawerPrimitive.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-2xl border border-border/60 bg-card max-h-[85vh] overflow-y-auto",
              className
            )}
          >
            <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
            <div className="flex items-center justify-between p-4">
              {title ? (
                <DrawerPrimitive.Title className="text-lg font-bold">
                  {title}
                </DrawerPrimitive.Title>
              ) : (
                <DrawerPrimitive.Title className="sr-only">
                  Sheet
                </DrawerPrimitive.Title>
              )}
              <DrawerPrimitive.Close className="ml-auto rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </DrawerPrimitive.Close>
            </div>
            <div className="px-4 pb-4">{children}</div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    )
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border/60 bg-card max-w-md w-full mx-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className
          )}
        >
          <div className="flex items-center justify-between p-4">
            {title ? (
              <DialogPrimitive.Title className="text-lg font-bold">
                {title}
              </DialogPrimitive.Title>
            ) : (
              <DialogPrimitive.Title className="sr-only">
                Sheet
              </DialogPrimitive.Title>
            )}
            <DialogPrimitive.Close className="ml-auto rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div className="px-4 pb-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { BottomSheet }
