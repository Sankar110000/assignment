import { cn } from 'cn'
import { X } from 'lucide-react'
import * as React from 'react'

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
})

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open = false, onOpenChange = () => {}, children }: DialogProps) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
}

function DialogTrigger({
  children,
  asChild,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const { onOpenChange } = React.useContext(DialogContext)
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
      onClick: (e: React.MouseEvent) => {
        const original = (children as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props
          .onClick
        if (original) original(e as React.MouseEvent<HTMLElement>)
        onOpenChange(true)
      },
    })
  }
  return (
    <button type="button" onClick={() => onOpenChange(true)} {...props}>
      {children}
    </button>
  )
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  const { open } = React.useContext(DialogContext)
  if (!open) return null
  return <>{children}</>
}

function DialogOverlay({ className, ...props }: React.ComponentProps<'div'>) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay backdrop handles click-outside dismissal
    <div
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]',
        'animate-in fade-in-0',
        className,
      )}
      role="presentation"
      onClick={() => onOpenChange(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onOpenChange(false)
      }}
      {...props}
    />
  )
}

function DialogContent({ className, children, ...props }: React.ComponentProps<'div'>) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        data-slot="dialog-content"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]',
          'rounded-xl border border-border bg-card p-6 shadow-xl',
          className,
        )}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 mb-4', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn('text-base font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
