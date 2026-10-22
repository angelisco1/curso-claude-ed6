import { describe, it, expect, beforeEach } from 'vitest'
import { MockTableRepository } from './MockTableRepository.js'
import type { Table } from '@models/table.model.js'

const mesa = (props: Partial<Table> & Pick<Table, 'id' | 'number'>): Table => ({
    description: null,
    capacity: 4,
    status: 'libre',
    occupiedBy: null,
    restaurantId: 'A',
    createdAt: '2026-10-22T10:00:00.000Z',
    updatedAt: '2026-10-22T10:00:00.000Z',
    ...props
})

describe('MockTableRepository', () => {
    let repo: MockTableRepository

    beforeEach(async () => {
        repo = new MockTableRepository()
        await repo.save(mesa({ id: 't1', number: 2, capacity: 6 }))
        await repo.save(mesa({ id: 't2', number: 1, capacity: 4 }))
        await repo.save(mesa({ id: 't3', number: 3, capacity: 4, status: 'reservada' }))
        await repo.save(mesa({ id: 't4', number: 1, restaurantId: 'B' }))
    })

    it('lista por restaurante ordenando por número y busca por número', async () => {
        expect((await repo.findByRestaurantId('A')).map(t => t.id)).toEqual(['t2', 't1', 't3'])
        expect((await repo.findByNumber('B', 1))?.id).toBe('t4')
        expect(await repo.findByNumber('B', 2)).toBeNull()
    })

    it('findAvailable filtra libres con capacidad y ordena por capacidad y número', async () => {
        expect((await repo.findAvailable('A', 4)).map(t => t.id)).toEqual(['t2', 't1'])
    })

    it('occupyIfFree replica la regla de una mesa por cliente', async () => {
        expect(await repo.occupyIfFree('A', 't2', 'c1')).toBe(true)
        expect((await repo.findByOccupant('c1'))?.id).toBe('t2')
        expect(await repo.occupyIfFree('A', 't1', 'c1')).toBe(false)
        expect(await repo.occupyIfFree('A', 't2', 'c2')).toBe(false)
        expect(await repo.occupyIfFree('A', 't3', 'c2')).toBe(false)
        expect(await repo.occupyIfFree('B', 't1', 'c2')).toBe(false)
    })

    it('no comparte referencias con quien guarda o lee', async () => {
        const leida = await repo.findById('t1')
        leida!.status = 'ocupada'
        expect((await repo.findById('t1'))?.status).toBe('libre')
    })

    it('delete elimina la mesa', async () => {
        await repo.delete('t1')
        expect(await repo.findById('t1')).toBeNull()
    })
})
