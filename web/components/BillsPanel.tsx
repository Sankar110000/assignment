import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  PlusCircle,
  ReceiptText,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShareItem {
  id: string
  memberId: string
  memberName: string
  amountCents: number
  paidAt: string | null
}

interface BillItem {
  id: string
  homeId: string
  title: string
  totalCents: number
  createdAt: string
  shares: ShareItem[]
}

interface MemberItem {
  id: string
  homeId: string
  name: string
  position: number
}

interface BillsPanelProps {
  homeId: string
  bills: BillItem[]
  members: MemberItem[]
  loading: boolean
  error: string
  onBillAdded: () => void
  onSharePaid?: () => void
}

// ─── Bill Form Schema ─────────────────────────────────────────────────────────

const billSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  // We accept a decimal dollar/rupee amount and convert to cents
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .refine((v) => {
      const n = Number(v)
      return !Number.isNaN(n) && n > 0
    }, 'Amount must be a positive number')
    .refine((v) => {
      // Max 2 decimal places
      return /^\d+(\.\d{1,2})?$/.test(v.trim())
    }, 'Amount can have at most 2 decimal places'),
})

type BillFormValues = z.infer<typeof billSchema>


// ─── Collapsible Bill Card ────────────────────────────────────────────────────

function BillCard({ bill, onSharePaid }: { bill: BillItem; onSharePaid?: () => void }) {
  const [open, setOpen] = useState(false)
  const [payingShareId, setPayingShareId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<{ shareId: string; message: string } | null>(
    null,
  )

  const paidCount = bill.shares.filter((s) => s.paidAt !== null).length
  const totalCount = bill.shares.length

  const handlePayShare = async (shareId: string) => {
    setPayingShareId(shareId)
    setPaymentError(null)

    try {
      const idempotencyKey = crypto.randomUUID()
      const res = await fetch(`/api/bills/${bill.id}/shares/${shareId}/pay`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      })

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null)
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Payment failed'
        setPaymentError({ shareId, message: msg })
        return
      }

      onSharePaid?.()
    } catch {
      setPaymentError({
        shareId,
        message: 'Network error occurred. The share remains unpaid.',
      })
    } finally {
      setPayingShareId(null)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
      {/* Header — clickable to toggle shares */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-medium text-sm text-foreground truncate">{bill.title}</span>
          <span className="text-xs text-muted-foreground">
            {paidCount}/{totalCount} paid
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="font-semibold text-sm text-foreground">
            {bill.totalCents}
          </span>
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </div>
      </button>

      {/* Shares — animated collapse */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border px-4 py-2.5 space-y-2">
            {bill.shares.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No shares found.</p>
            ) : (
              bill.shares.map((share) => (
                <div key={share.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-foreground truncate">
                        {share.memberName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {share.amountCents}
                      </span>
                    </div>

                    {share.paidAt !== null ? (
                      <div className="flex items-center gap-1 text-green-600 shrink-0">
                        <CheckCircle2 className="size-3.5" />
                        <span className="text-xs font-medium">Paid</span>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={payingShareId === share.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handlePayShare(share.id)
                        }}
                        className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        {payingShareId === share.id ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            Paying…
                          </>
                        ) : (
                          'Pay'
                        )}
                      </Button>
                    )}
                  </div>

                  {paymentError?.shareId === share.id && (
                    <div className="flex items-center justify-between text-[11px] text-destructive bg-destructive/10 px-2 py-1 rounded">
                      <div className="flex items-center gap-1 min-w-0">
                        <AlertCircle className="size-3 shrink-0" />
                        <span className="truncate">{paymentError.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentError(null)}
                        className="font-medium underline ml-2 shrink-0 cursor-pointer text-[10px]"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Bill Dialog ──────────────────────────────────────────────────────────

function AddBillDialog({
  homeId,
  members,
  onBillAdded,
}: {
  homeId: string
  members: MemberItem[]
  onBillAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: { title: '', amount: '' },
  })

  const onSubmit = async (values: BillFormValues) => {
    setServerError('')
    setSubmitting(true)


    try {
      const res = await fetch(`/api/homes/${homeId}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: values.title, totalCents: Number(values.amount) }),
      })
      
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null)
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Failed to add bill'
        setServerError(msg)
        return
      }

      form.reset()
      setOpen(false)
      onBillAdded()
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          form.reset()
          setServerError('')
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="gap-1.5 cursor-pointer">
          <PlusCircle className="size-3.5" />
          Add Bill
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a new bill</DialogTitle>
          <DialogDescription>
            The bill will be split evenly across all{' '}
            <span className="font-medium text-foreground">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </span>{' '}
            in this home.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="bill-title">Title</Label>
            <Input id="bill-title" placeholder="e.g. Groceries" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="bill-amount">Amount (₹)</Label>
            <Input
              id="bill-amount"
              placeholder="e.g. 10.00"
              inputMode="decimal"
              {...form.register('amount')}
            />
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
            )}
          </div>

          {/* Members preview */}
          {members.length > 0 && (
            <div className="rounded-md border border-dashed border-border p-3 space-y-1">
              <p className="text-xs text-muted-foreground font-medium mb-1">Split between:</p>
              {members.map((m) => (
                <p key={m.id} className="text-xs text-foreground">
                  • {m.name}
                </p>
              ))}
            </div>
          )}

          {/* Server error */}
          {serverError && <p className="text-xs text-destructive">{serverError}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false)
                form.reset()
                setServerError('')
              }}
              className={'cursor-pointer'}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || members.length === 0}
              className={'cursor-pointer'}
            >
              {submitting && <Loader2 className="size-3 animate-spin" />}
              {submitting ? 'Adding…' : 'Add Bill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── BillsPanel (right column) ────────────────────────────────────────────────

export default function BillsPanel({
  homeId,
  bills,
  members,
  loading,
  error,
  onBillAdded,
  onSharePaid,
}: BillsPanelProps) {
  console.log(bills);
  
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Bills</h2>
          <p className="text-sm text-slate-500 mt-0.5">Bills and shares for this home.</p>
        </div>

        <AddBillDialog homeId={homeId} members={members} onBillAdded={onBillAdded} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Loading bills…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* No members warning */}
      {!loading && !error && members.length === 0 && (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-8 text-center">
            <h3 className="font-medium text-slate-800">No members yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              Add members to this home before creating bills.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty bills */}
      {!loading && !error && members.length > 0 && bills.length === 0 && (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-8 text-center">
            <ReceiptText className="size-8 mx-auto text-slate-300 mb-2" />
            <h3 className="font-medium text-slate-800">No bills yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              Click "Add Bill" to create the first bill.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bills list */}
      {!loading && !error && bills.length > 0 && (
        <div className="space-y-2">
          {bills.map((bill) => (
            <BillCard key={bill.id} bill={bill} onSharePaid={onSharePaid ?? onBillAdded} />
          ))}
        </div>
      )}
    </div>
  )
}
