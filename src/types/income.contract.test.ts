import { expectTypeOf, it } from 'vitest'
import type { CreateIncomeInput } from './income'
it('makes categories impossible on transfers', () => {
  expectTypeOf<
    Extract<CreateIncomeInput, { kind: 'TRANSFER' }>['typeId']
  >().toEqualTypeOf<null>()
  expectTypeOf<
    Extract<CreateIncomeInput, { kind: 'EXTERNAL_INCOME' }>['fromSourceId']
  >().toEqualTypeOf<null>()
})
