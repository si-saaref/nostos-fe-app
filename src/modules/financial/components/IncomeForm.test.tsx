import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { chooseOption, renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { db } from '@/mocks/db'
import {
  INCOME_TYPE_IDS,
  INCOME_TYPE_NAMES,
} from '@/mocks/fixtures/incomeTypes'
import { ACCOUNT_IDS } from '@/mocks/fixtures/accounts'
import { IncomeForm } from '@/modules/financial/components/IncomeForm'
import type { Income } from '@/types/income'

describe('IncomeForm', () => {
  it('submits the type as an id, not the word on screen', async () => {
    const bodies: Record<string, unknown>[] = []
    const record = async ({ request }: { request: Request }) => {
      if (request.method === 'POST') {
        bodies.push((await request.clone().json()) as Record<string, unknown>)
      }
    }
    server.events.on('request:start', record)

    const onSuccess = vi.fn()
    renderWithProviders(<IncomeForm onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/keterangan/i), 'Gaji')
    await userEvent.type(screen.getByLabelText(/jumlah/i), '5000000')
    await chooseOption(/jenis/i, INCOME_TYPE_NAMES[0])
    await chooseOption(/masuk ke sumber/i, /^QRIS$/)
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    server.events.removeListener('request:start', record)

    expect(bodies[0].type_id).toBe(INCOME_TYPE_IDS[0])
    expect(bodies[0]).not.toHaveProperty('type')
  })

  // An admin correcting an amount must not silently retype the entry, and the
  // archived type's own word — not its uuid — is what has to be on screen.
  it('keeps an archived type selected on edit, showing its name', async () => {
    const archived = db.incomeTypes[1]
    archived.archivedAt = '2026-08-30T00:00:00.000Z'

    const income: Income = {
      id: 'inc-1',
      name: 'Bonus lama',
      amount: 4250000,
      typeId: archived.id,
      fromSourceId: null,
      toSourceId: ACCOUNT_IDS[0],
      date: '2026-08-12',
      householdId: db.incomeTypes[0].householdId,
    }

    renderWithProviders(<IncomeForm income={income} />)

    const trigger = await screen.findByRole('combobox', { name: /jenis/i })
    await waitFor(() => expect(trigger).toHaveTextContent(archived.name))
    expect(trigger).not.toHaveTextContent(archived.id)
  })
})

describe('IncomeForm when the household is not set up', () => {
  // The distinction this encodes: a required field is the member's to fix in
  // place, so submit stays live and answers on the field. A missing income
  // type is the household's to fix in Settings — the picker has no options at
  // all — so submitting could only ever name the wrong problem.
  it('names the missing setup and sends nothing when submitted', async () => {
    db.incomeTypes.length = 0
    const posts: string[] = []
    const record = ({ request }: { request: Request }) => {
      if (request.method === 'POST') posts.push(request.url)
    }
    server.events.on('request:start', record)

    const onSuccess = vi.fn()
    renderWithProviders(<IncomeForm onSuccess={onSuccess} />)

    const submit = await screen.findByRole('button', { name: /catat/i })
    await waitFor(() => expect(submit).toHaveAttribute('aria-disabled', 'true'))

    // Reachable and self-explaining: a truly `disabled` button leaves the tab
    // order before it can say why.
    expect(submit).not.toBeDisabled()
    const reason = document.getElementById(
      submit.getAttribute('aria-describedby') ?? '',
    )
    expect(reason).toHaveTextContent(/jenis pemasukan/i)

    await userEvent.click(submit)
    server.events.removeListener('request:start', record)

    expect(posts).toHaveLength(0)
    expect(onSuccess).not.toHaveBeenCalled()
    // And it does not blame an empty field for a list that does not exist.
    expect(screen.queryByText(/wajib/i)).not.toBeInTheDocument()
  })
})

describe('IncomeForm layout contracts', () => {
  // The hint used to sit in the action row, ~600px from the picker it
  // describes, where nothing connected it to the field and a screen reader
  // never reached it at all.
  it('describes the From source picker from the field, not the button row', async () => {
    renderWithProviders(<IncomeForm />)

    const fromSource = await screen.findByRole('combobox', {
      name: /dari sumber/i,
    })
    const describedBy = fromSource.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent(
      /dari luar rumah/i,
    )

    // And the actions carry nothing but actions.
    const submit = screen.getByRole('button', { name: /catat/i })
    expect(submit.parentElement).toHaveTextContent(/^(Catat|Batal)+$/)
  })

  it('puts the submit last so it meets the eye at the final field', async () => {
    renderWithProviders(<IncomeForm onCancel={() => {}} />)

    const actions = (await screen.findByRole('button', { name: /catat/i }))
      .parentElement
    const labels = Array.from(actions?.children ?? []).map(
      (child) => child.textContent,
    )
    expect(labels).toEqual(['Batal', 'Catat'])
    expect(actions?.className).toMatch(/justify-end/)
  })
})
