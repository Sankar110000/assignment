import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, PlusCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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

// Validation schema for search
const homeSchema = z.object({
  homeId: z.string().trim().min(1, 'Home ID is required'),
})

type HomeFormValues = z.infer<typeof homeSchema>

// Validation schema for creating a home
const createHomeSchema = z.object({
  name: z.string().trim().min(1, 'Home name is required'),
})

type CreateHomeFormValues = z.infer<typeof createHomeSchema>

interface HomeData {
  id: string
  name: string
  createdAt: string
}

interface Props {
  setHomeId: CallableFunction
  onSearchHome: CallableFunction
}

// ─── Add Home Dialog ──────────────────────────────────────────────────────────

function AddHomeDialog({ onHomeCreated }: { onHomeCreated: (home: HomeData) => void }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CreateHomeFormValues>({
    resolver: zodResolver(createHomeSchema),
    defaultValues: { name: '' },
  })

  const handleClose = () => {
    setOpen(false)
    form.reset()
    setServerError('')
  }

  const onSubmit = async (values: CreateHomeFormValues) => {
    setServerError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/homes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name.trim() }),
      })

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null)
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Failed to create home'
        setServerError(msg)
        return
      }

      const created: HomeData = await res.json()
      handleClose()
      onHomeCreated(created)
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
          Add Home
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create a new home</DialogTitle>
          <DialogDescription>
            Enter a name for your home to get started with shared bill splitting.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="home-name">Home Name</Label>
            <Input
              id="home-name"
              placeholder="e.g. Baker Street Flat"
              autoFocus
              {...form.register('name')}
            />
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
              {submitting ? 'Creating…' : 'Create Home'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Home Component ───────────────────────────────────────────────────────────

export default function Home({ setHomeId }: Props) {
  const [homes, setHomes] = useState<HomeData[]>([])
  const [loading, setLoading] = useState(true)
  const [searching] = useState(false)
  const [error, setError] = useState('')

  const form = useForm<HomeFormValues>({
    resolver: zodResolver(homeSchema),
    defaultValues: {
      homeId: '',
    },
  })

  // Fetch all homes
  const fetchHomes = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/homes')

      if (!response.ok) {
        throw new Error('Failed to fetch homes')
      }

      const result: { data: HomeData[] } = await response.json()
      setHomes(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchHomes()
  }, [fetchHomes])

  const handleHomeCreated = (newHome: HomeData) => {
    form.setValue('homeId', newHome.id)
    setHomeId(newHome.id)
    void fetchHomes()
  }

  return (
    <div className="space-y-4">
      {/* Search Form */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Find a Home</h2>

          <p className="mt-1 text-sm text-slate-500">Enter your home ID to find its details.</p>
        </div>

        <form
          onSubmit={form.handleSubmit((values) => setHomeId(values.homeId))}
          className="flex flex-col gap-4 sm:flex-row sm:items-start"
        >
          <div className="flex-1 space-y-2">
            <label htmlFor="homeId" className="text-sm font-medium text-slate-700">
              Home ID
            </label>

            <Input id="homeId" placeholder="Enter your home ID" {...form.register('homeId')} />

            {form.formState.errors.homeId && (
              <p className="text-sm text-red-500">{form.formState.errors.homeId.message}</p>
            )}
          </div>

          <Button type="submit" disabled={searching} className="sm:mt-7">
            {searching ? 'Searching...' : 'Search Home'}
          </Button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>

          {!searching && !loading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError('')
                void fetchHomes()
              }}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {/* All Homes */}
      <section>
        <div className="flex items-center justify-between mt-2 mb-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">All Homes</h2>
            <p className="mt-1 text-sm text-slate-500">Select a home to view its details.</p>
          </div>

          <div className="flex items-center gap-3">
            {!loading && <span className="text-sm text-slate-500">{homes.length} homes</span>}
            <AddHomeDialog onHomeCreated={handleHomeCreated} />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-12 text-center text-sm text-slate-500">Loading homes...</div>
        )}

        {/* Empty State */}
        {!loading && !error && homes.length === 0 && (
          <Card className="border-dashed shadow-none">
            <CardContent className="py-12 text-center">
              <h3 className="font-medium text-slate-800">No homes found</h3>
              <p className="mt-2 text-sm text-slate-500 mb-4">
                Create your first home to start splitting bills.
              </p>
              <AddHomeDialog onHomeCreated={handleHomeCreated} />
            </CardContent>
          </Card>
        )}

        {/* Homes Grid */}
        {!loading && !error && homes.length > 0 && (
          <div className="grid grid-col-1">
            <div className="grid grid-cols-1 gap-3">
              {homes.map((home) => (
                <div
                  key={home.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-medium text-slate-800">{home.name}</h3>
                    <p className="text-sm text-slate-500 break-all">ID: {home.id}</p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError('')
                      form.setValue('homeId', home.id)
                      setHomeId(home.id)
                    }}
                  >
                    Select Home
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
