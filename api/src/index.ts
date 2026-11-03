import { Hono } from 'hono'
import type { Member, Share } from '../../types/models.types'
import type { HomeBody } from '../../types/response.types'
import { ApiError } from './lib/ApiError'
import { errorHandler } from './lib/error-handler'

const app = new Hono<{ Bindings: Env }>()

app.onError(errorHandler)

app.get('/api/health', (c) => {
  return c.json({ status: 'ok' })
})

app.post('/api/homes', async (c) => {
  const { name }: { name: string } = await c.req.json()

  const normalizedName = name.trim()

  if (!normalizedName) throw new ApiError(400, 'name is a required field')

  const id = crypto.randomUUID()

  const result = await c.env.DB.prepare(`
        INSERT INTO homes (id, name)
        VALUES (?, ?)
        `)
    .bind(id, name)
    .run()

  if (!result.success) throw new ApiError(500, 'Internal server error')
  return c.json({ id, name }, 201)
})

app.get('/api/homes', async (c) => {
  const result = (await c.env.DB.prepare(`SELECT * from (homes)`).all<HomeBody>()).results
  return c.json({ data: result }, 200)
})

app.post('/api/homes/:homeId/members', async (c) => {
  const { name } = await c.req.json()
  const { homeId } = c.req.param()

  const normalizedName = name.trim()

  const home = await c.env.DB.prepare(`
        SELECT id, name
        FROM homes
        WHERE id = ?
  `)
    .bind(homeId)
    .first()

  if (!home) {
    throw new ApiError(404, 'Home not found')
  }

  const id = crypto.randomUUID()

  const result = await c.env.DB.prepare(`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_position
        FROM members
        WHERE home_id = ?;
        `)
    .bind(homeId)
    .first<{ next_position: number }>()

  await c.env.DB.prepare(`
        INSERT INTO members (id, home_id, name, position)
        VALUES (?, ?, ?, ?)
        RETURNING id, home_id, name, position
  `)
    .bind(id, homeId, normalizedName, result?.next_position)
    .first()

  return c.json({ id, homeId: homeId, name: name }, 201)
})

app.post('/api/homes/:homeId/bills', async (c) => {
  const { homeId }: { homeId: string } = c.req.param()
  let body: { title: string; totalCents: number }
  try {
    body = await c.req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  const { title, totalCents } = body

  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new ApiError(422, 'Total must be a positive whole number')
  }

  const existingHome = await c.env.DB.prepare(`
        SELECT id from homes 
        WHERE id = ?
        `)
    .bind(homeId)
    .first()
  if (!existingHome) throw new ApiError(404, 'Home not Found')

  const members = await c.env.DB.prepare(`
        SELECT * FROM members 
        WHERE home_id = ?
        ORDER BY position
        `)
    .bind(homeId)
    .all<Member>()

  const membersResult = members.results

  if (membersResult.length <= 0) throw new ApiError(422, 'No members in this home')

  const billId = crypto.randomUUID()

  const baseShare = Math.floor(totalCents / membersResult.length)
  const remainingCents = totalCents % membersResult.length

  const shares = membersResult.map((m, i) => ({
    id: crypto.randomUUID(),
    memberId: m.id,
    amountCents: baseShare + (i < remainingCents ? 1 : 0),
    paidAt: null,
  }))

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)',
    ).bind(billId, homeId, title.trim(), totalCents),
    ...shares.map((s) =>
      c.env.DB.prepare(
        'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
      ).bind(s.id, billId, s.memberId, s.amountCents),
    ),
  ])

  return c.json({ id: billId, homeId, title: title.trim(), totalCents, shares }, 201)
})

app.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  const { billId, shareId }: { billId: string; shareId: string } = c.req.param()
  const key = c.req.header('Idempotency-Key')

  if (!key) throw new ApiError(400, 'Idempotency-Key missing')

  const result = await c.env.DB.prepare(`
        UPDATE shares
        SET paid_at = ?, payment_key = ?
        WHERE id = ?
        AND bill_id = ?
        AND paid_at IS NULL
        RETURNING id, member_id,amount_cents, paid_at, payment_key
        `)
    .bind(new Date().toISOString(), key, shareId, billId)
    .first<Share>()

  if (result)
    return c.json(
      {
        id: result.id,
        memberId: result.member_id,
        amountCents: result.amount_cents,
        paidAt: result.paid_at,
      },
      200,
    )

  const existing = await c.env.DB.prepare(`
        SELECT id, member_id, amount_cents, paid_at, payment_key
        FROM shares 
        WHERE id = ? AND bill_id = ?
        `)
    .bind(shareId, billId)
    .first<Share>()
  if (!existing) throw new ApiError(404, 'share or bill do not exists')

  if (existing.payment_key === key) {
    return c.json(
      {
        id: existing.id,
        memberId: existing.member_id,
        amountCents: existing.amount_cents,
        paidAt: existing.paid_at,
      },
      200,
    )
  }

  throw new ApiError(409, 'Share already paid with a different key')
})

app.get('/api/homes/:homeId/members', async (c) => {
  const { homeId } = c.req.param()
  const home = await c.env.DB.prepare(`
        SELECT id FROM homes
        WHERE id = ?
        `)
    .bind(homeId)
    .first()
  if (!home) throw new ApiError(404, 'Home not found')

  const { results } = await c.env.DB.prepare(`
        SELECT id, home_id, name, position, created_at
        FROM members
        WHERE home_id = ?
        ORDER BY position
        `)
    .bind(homeId)
    .all<{ id: string; home_id: string; name: string; position: number; created_at: string }>()

  const members = results.map((m) => ({
    id: m.id,
    homeId: m.home_id,
    name: m.name,
    position: m.position,
  }))

  return c.json({ members })
})

app.get('/api/homes/:homeId/bills', async (c) => {
  const { homeId } = c.req.param()
  const home = await c.env.DB.prepare(`
        SELECT id FROM homes
        WHERE id = ?
        `)
    .bind(homeId)
    .first()
  if (!home) throw new ApiError(404, 'Home not found')

  const { results: bills } = await c.env.DB.prepare(`
        SELECT id, home_id, title, total_cents, created_at
        FROM bills
        WHERE home_id = ?
        ORDER BY created_at DESC
        `)
    .bind(homeId)
    .all<{ id: string; home_id: string; title: string; total_cents: number; created_at: string }>()

  const billIds = bills.map((b) => b.id)

  if (billIds.length === 0) {
    return c.json({ bills: [] })
  }

  const placeholders = billIds.map(() => '?').join(', ')
  const { results: shares } = await c.env.DB.prepare(`
        SELECT s.id, s.bill_id, s.member_id, s.amount_cents, s.paid_at, m.name AS member_name
        FROM shares s
        JOIN members m ON s.member_id = m.id
        WHERE s.bill_id IN (${placeholders})
        `)
    .bind(...billIds)
    .all<{
      id: string
      bill_id: string
      member_id: string
      amount_cents: number
      paid_at: string | null
      member_name: string
    }>()

  const sharesByBill = new Map<
    string,
    {
      id: string
      memberId: string
      memberName: string
      amountCents: number
      paidAt: string | null
    }[]
  >()
  for (const s of shares) {
    const list = sharesByBill.get(s.bill_id) ?? []
    list.push({
      id: s.id,
      memberId: s.member_id,
      memberName: s.member_name,
      amountCents: s.amount_cents,
      paidAt: s.paid_at,
    })
    sharesByBill.set(s.bill_id, list)
  }

  const result = bills.map((b) => ({
    id: b.id,
    homeId: b.home_id,
    title: b.title,
    totalCents: b.total_cents,
    createdAt: b.created_at,
    shares: sharesByBill.get(b.id) ?? [],
  }))

  return c.json({ bills: result })
})

app.get('/api/homes/:homeId/balances', async (c) => {
  const { homeId } = c.req.param()
  const home = await c.env.DB.prepare(`
        SELECT id FROM homes
        WHERE id = ? 
        `)
    .bind(homeId)
    .first()
  if (!home) throw new ApiError(404, 'Home not found')

  const { results } = await c.env.DB.prepare(`
        SELECT m.id AS member_id,
                m.name AS member_name,
                COALESCE(SUM(s.amount_cents), 0) AS outstanding_cents
        FROM members m
        LEFT JOIN shares s
        ON s.member_id = m.id AND s.paid_at IS NULL
        WHERE home_id = ?
        GROUP BY m.id, m.name, m.position
        ORDER BY m.position
        `)
    .bind(homeId)
    .all<{ member_id: string; member_name: string; outstanding_cents: number }>()
  const balances = results.map((r) => ({
    memberId: r.member_id,
    name: r.member_name,
    outstandingCents: r.outstanding_cents,
  }))

  return c.json({ balances })
})

export default app
