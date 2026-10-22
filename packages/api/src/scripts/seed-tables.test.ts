import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Database } from '@config/database.js'
import { seedTables, SEED_OCCUPIED_TABLE_ID } from './seed-tables.js'

describe('seedTables', () => {
    let db: Database

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        const now = new Date().toISOString()
        for (const id of ['rest-1', 'rest-2']) {
            await db.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, id, 'Calle', `${id}@x.com`, '600000000', 'A', 'B', now, now]
            )
        }
    })

    afterAll(async () => {
        await db.close()
    })

    it('crea mesas con ids fijos, varias capacidades y estados en ambos restaurantes', async () => {
        await seedTables(db)
        const filas = await db.all<{ id: string; restaurant_id: string; capacity: number; status: string; occupied_by: string | null }>(
            'SELECT id, restaurant_id, capacity, status, occupied_by FROM restaurant_tables'
        )
        const rest1 = filas.filter(f => f.restaurant_id === 'rest-1')
        const rest2 = filas.filter(f => f.restaurant_id === 'rest-2')
        expect(rest1.length).toBeGreaterThan(0)
        expect(rest2.length).toBeGreaterThan(0)
        expect(new Set(rest1.map(f => f.status))).toEqual(new Set(['libre', 'ocupada', 'reservada']))
        expect(new Set(rest1.map(f => f.capacity)).size).toBeGreaterThan(1)
        expect(filas.every(f => f.id.startsWith('mesa-'))).toBe(true)
        expect(filas.every(f => f.occupied_by === null)).toBe(true)
    })

    it('expone el id de una mesa ocupada de rest-1 para el pedido de ejemplo', async () => {
        const mesa = await db.get<{ status: string; restaurant_id: string }>('SELECT status, restaurant_id FROM restaurant_tables WHERE id = ?', [SEED_OCCUPIED_TABLE_ID])
        expect(mesa).toEqual({ status: 'ocupada', restaurant_id: 'rest-1' })
    })

    it('es idempotente', async () => {
        const antes = await db.all('SELECT * FROM restaurant_tables')
        await seedTables(db)
        expect(await db.all('SELECT * FROM restaurant_tables')).toEqual(antes)
    })
})
