import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SqliteTableRepository } from './table.repository.js'
import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'

const insertRestaurant = (db: Database, id: string) => {
    const now = new Date().toISOString()
    return db.run(
        'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, `Restaurante ${id}`, 'Calle Mayor 10', `${id}@x.com`, '+34 612345678', 'Carlos', 'García', now, now]
    )
}

const insertClient = (db: Database, id: string) =>
    db.run(
        'INSERT INTO employees (id, first_name, last_name, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, 'Cliente', 'Prueba', `${id}@x.com`, 'hash', 'cliente', null]
    )

const buildTable = (props: Partial<Table> & Pick<Table, 'id' | 'number' | 'restaurantId'>): Table => ({
    description: null,
    capacity: 4,
    status: 'libre',
    occupiedBy: null,
    createdAt: '2026-10-22T10:00:00.000Z',
    updatedAt: '2026-10-22T10:00:00.000Z',
    ...props
})

describe('SqliteTableRepository (integración)', () => {
    let db: Database
    let repo: SqliteTableRepository

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteTableRepository(db)
        await insertRestaurant(db, 'r1')
        await insertRestaurant(db, 'r2')
        await insertClient(db, 'c1')
        await insertClient(db, 'c2')
    })

    afterAll(async () => {
        await db.close()
    })

    describe('CRUD básico', () => {
        it('guarda y recupera una mesa por id con todos sus campos', async () => {
            const table = buildTable({ id: 't-crud-1', number: 1, description: 'Ventana', restaurantId: 'r1' })
            await repo.save(table)
            expect(await repo.findById('t-crud-1')).toEqual(table)
        })

        it('devuelve null si la mesa no existe', async () => {
            expect(await repo.findById('no-existe')).toBeNull()
        })

        it('actualiza una mesa existente', async () => {
            const updated = buildTable({
                id: 't-crud-1', number: 7, description: null, capacity: 6, status: 'ocupada', occupiedBy: 'c1',
                restaurantId: 'r1', updatedAt: '2026-10-22T11:00:00.000Z'
            })
            await repo.save(updated)
            expect(await repo.findById('t-crud-1')).toEqual(updated)
        })

        it('lista las mesas de un restaurante ordenadas por número', async () => {
            await repo.save(buildTable({ id: 't-crud-2', number: 3, restaurantId: 'r1' }))
            await repo.save(buildTable({ id: 't-crud-3', number: 1, restaurantId: 'r2' }))
            const tables = await repo.findByRestaurantId('r1')
            expect(tables.map(t => t.number)).toEqual([3, 7])
        })

        it('busca por número dentro del restaurante', async () => {
            expect((await repo.findByNumber('r1', 3))?.id).toBe('t-crud-2')
            expect(await repo.findByNumber('r2', 3)).toBeNull()
        })

        it('elimina una mesa', async () => {
            await repo.delete('t-crud-2')
            expect(await repo.findById('t-crud-2')).toBeNull()
        })
    })

    describe('disponibilidad y ocupación', () => {
        beforeAll(async () => {
            await insertRestaurant(db, 'r-occ')
            await repo.save(buildTable({ id: 't-occ-1', number: 1, capacity: 2, restaurantId: 'r-occ' }))
            await repo.save(buildTable({ id: 't-occ-2', number: 2, capacity: 4, restaurantId: 'r-occ' }))
        })

        it('findAvailable devuelve las mesas libres con capacidad suficiente', async () => {
            const tables = await repo.findAvailable('r-occ', 3)
            expect(tables.map(t => t.id)).toEqual(['t-occ-2'])
        })

        it('occupyIfFree ocupa una mesa libre y la asocia al cliente', async () => {
            expect(await repo.occupyIfFree('r-occ', 't-occ-1', 'c2')).toBe(true)
            const table = await repo.findById('t-occ-1')
            expect(table?.status).toBe('ocupada')
            expect(table?.occupiedBy).toBe('c2')
        })

        it('findByOccupant devuelve la mesa del cliente o null', async () => {
            expect((await repo.findByOccupant('c2'))?.id).toBe('t-occ-1')
            expect(await repo.findByOccupant('nadie')).toBeNull()
        })
    })
})
