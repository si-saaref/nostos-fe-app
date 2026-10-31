import { compactMemberLabels } from './memberLabel'
it('uses last names and deterministic duplicate, legacy and former-member fallbacks', () => {
  const members = [
    { id: 'a', name: 'Jane Doe', firstName: 'Jane', lastName: 'Doe' },
    { id: 'b', name: 'John Doe', firstName: 'John', lastName: 'Doe' },
    { id: 'c', name: 'Sari' },
    { id: 'd', name: '' },
    { id: 'e', name: 'Anna Smith', firstName: 'Anna', lastName: 'Smith' },
  ]
  const labels = compactMemberLabels(members)
  expect(labels.get('a')).toBe('Jane Doe')
  expect(labels.get('b')).toBe('John Doe')
  expect(labels.get('c')).toBe('Sari')
  expect(labels.get('d')).toBe('—')
  expect(labels.get('e')).toBe('Smith')
  expect(compactMemberLabels([...members].reverse())).toEqual(labels)
})
it('uses stable ids when even full names collide', () => {
  const labels = compactMemberLabels([
    { id: 'b', name: 'Jane Doe' },
    { id: 'a', name: 'Jane Doe' },
  ])
  expect(new Set(labels.values()).size).toBe(2)
})
