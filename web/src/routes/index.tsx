import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import BillsPanel from '../../components/BillsPanel'
import Home from '../../components/Home'
import MembersPanel from '../../components/MembersPanel'

export const Route = createFileRoute('/')({
  component: Index,
})

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

interface MemberBalance {
  memberId: string
  name: string
  outstandingCents: number
}

function Index() {
  const [homeId, setHomeId] = useState<string | null>(null)

  const [bills, setBills] = useState<BillItem[]>([])
  const [members, setMembers] = useState<MemberItem[]>([])
  const [balances, setBalances] = useState<MemberBalance[]>([])

  const [dataLoading, setDataLoading] = useState(false)
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  // Fetch bills + members together
  const fetchHomeData = useCallback(async (id: string) => {
    setDataLoading(true)
    setDataError('')
    setBills([])
    setMembers([])
    setBalances([])

    try {
      const [billsRes, membersRes] = await Promise.all([
        fetch(`/api/homes/${id}/bills`),
        fetch(`/api/homes/${id}/members`),
      ])

      if (!billsRes.ok) {
        const data: unknown = await billsRes.json()
        throw new Error(
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Failed to load bills',
        )
      }
      if (!membersRes.ok) {
        const data: unknown = await membersRes.json()
        throw new Error(
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Failed to load members',
        )
      }

      const billsData = (await billsRes.json()) as { bills: BillItem[] }
      const membersData = (await membersRes.json()) as { members: MemberItem[] }

      setBills(billsData.bills)
      setMembers(membersData.members)
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setDataLoading(false)
    }
  }, [])

  // Fetch balances separately so they can be refreshed independently
  const fetchBalances = useCallback(async (id: string) => {
    setBalancesLoading(true)
    try {
      const res = await fetch(`/api/homes/${id}/balances`)
      if (!res.ok) return
      const data = (await res.json()) as { balances: MemberBalance[] }
      setBalances(data.balances)
    } catch {
      // silently ignore
    } finally {
      setBalancesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (homeId) {
      void fetchHomeData(homeId)
      void fetchBalances(homeId)
    } else {
      setBills([])
      setMembers([])
      setBalances([])
      setDataError('')
    }
  }, [homeId, fetchHomeData, fetchBalances])

  const handleSetHomeId = useCallback((id: string) => {
    setHomeId(id)
  }, [])

  // Called after adding a member — refresh members + balances
  const handleMemberAdded = useCallback(() => {
    if (homeId) {
      void fetchHomeData(homeId)
      void fetchBalances(homeId)
    }
  }, [homeId, fetchHomeData, fetchBalances])

  // Called after adding a bill — refresh bills + balances
  const handleBillAdded = useCallback(() => {
    if (homeId) {
      void fetchHomeData(homeId)
      void fetchBalances(homeId)
    }
  }, [homeId, fetchHomeData, fetchBalances])

  return (
    <main className="p-6 md:p-10 mx-auto max-w-6xl space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Bill Splitter</h1>
        <p className="text-sm text-slate-500 mt-1">
          Easily manage shared expenses, split bills, and keep track of payments across your homes.
        </p>
      </div>

      {/* Two-column layout */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left — home search + list (sticky) */}
        <div className="md:sticky md:top-6">
          <Home setHomeId={handleSetHomeId} onSearchHome={handleSetHomeId} />
        </div>

        {/* Right — members + bills stacked */}
        <div className="flex flex-col gap-6">
          {homeId ? (
            <>
              {/* Members + balances */}
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <MembersPanel
                  homeId={homeId}
                  members={members}
                  balances={balances}
                  balancesLoading={balancesLoading}
                  loading={dataLoading}
                  error={dataError}
                  onMemberAdded={handleMemberAdded}
                />
              </div>

              {/* Divider */}
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <BillsPanel
                  homeId={homeId}
                  bills={bills}
                  members={members}
                  loading={dataLoading}
                  error={dataError}
                  onBillAdded={handleBillAdded}
                  onSharePaid={handleBillAdded}
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-12 text-center">
              <p className="text-sm text-slate-400">
                Select a home on the left to view its members and bills.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
