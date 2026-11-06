import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, PlusCircle, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

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

export interface MemberBalance {
  memberId: string
  name: string
  outstandingCents: number
}

export interface MemberItem {
  id: string
  homeId: string
  name: string
  position: number
}

interface MembersPanelProps {
  homeId: string
  members: MemberItem[]
  balances: MemberBalance[]
  balancesLoading: boolean
  loading: boolean
  error: string
  onMemberAdded: () => void
}

// ─── Add Member Form Schema ───────────────────────────────────────────────────

const memberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
})

type MemberFormValues = z.infer<typeof memberSchema>

// ─── Outstanding badge ────────────────────────────────────────────────────────

function OutstandingBadge({ cents }: { cents: number }) {
  if (cents === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        Settled
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
      Owes {cents}
    </span>
  )
}

// ─── Add Member Dialog ────────────────────────────────────────────────────────

function AddMemberDialog({ homeId, onMemberAdded }: { homeId: string; onMemberAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { name: '' },
  })

  const handleClose = () => {
    setOpen(false)
    form.reset()
    setServerError('')
  }

  const onSubmit = async (values: MemberFormValues) => {
    setServerError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/homes/${homeId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name }),
      })

      if (!res.ok) {
        const data: unknown = await res.json()
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Failed to add member'
        setServerError(msg)
        return
      }

      handleClose()
      onMemberAdded()
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
        if (!o) handleClose()
        else setOpen(true)
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="gap-1.5 cursor-pointer">
          <PlusCircle className="size-3.5" />
          Add Member
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a new member</DialogTitle>
          <DialogDescription>
            The member will be added to this home and included in future bill splits.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-name">Name</Label>
            <Input id="member-name" placeholder="e.g. Asha" autoFocus {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {serverError && <p className="text-xs text-destructive">{serverError}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className={'cursor-pointer'}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className={'cursor-pointer'}>
              {submitting && <Loader2 className="size-3 animate-spin" />}
              {submitting ? 'Adding…' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── MembersPanel ─────────────────────────────────────────────────────────────

export default function MembersPanel({
  homeId,
  members,
  balances,
  balancesLoading,
  loading,
  error,
  onMemberAdded,
}: MembersPanelProps) {
  // Map memberId → outstandingCents for O(1) lookup
  const balanceMap = new Map(balances.map((b) => [b.memberId, b.outstandingCents]))

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Members</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            People in this home and their outstanding balances.
          </p>
        </div>
        <AddMemberDialog homeId={homeId} onMemberAdded={onMemberAdded} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Loading members…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && members.length === 0 && (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-8 text-center">
            <Users className="size-8 mx-auto text-slate-300 mb-2" />
            <h3 className="font-medium text-slate-800">No members yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              Add the first member using the button above.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      {!loading && !error && members.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden shadow-sm">
          {members.map((member, idx) => {
            const outstanding = balanceMap.get(member.id) ?? null

            return (
              <div key={member.id} className="flex items-center justify-between px-4 py-3 gap-3">
                {/* Rank avatar + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate">
                    {member.name}
                  </span>
                </div>

                {/* Balance badge */}
                <div className="shrink-0">
                  {balancesLoading ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  ) : outstanding !== null ? (
                    <OutstandingBadge cents={outstanding} />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
