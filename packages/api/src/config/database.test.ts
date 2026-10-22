import { describe, it, expect } from 'vitest'
import { dbConfig } from '@config/database.js'
import { setupTestDatabase } from '../test/http-helpers.js'

setupTestDatabase()

describe('migraciones: restaurant_tables', () => {
    it('crea la tabla restaurant_tables con sus columnas', async () => {
        const columnas = await dbConfig.all<{ name: string; notnull: number; dflt_value: string | null }>('PRAGMA table_info(restaurant_tables)')
        expect(columnas.map(c => c.name)).toEqual([
            'id', 'number', 'description', 'capacity', 'status', 'occupied_by', 'restaurant_id', 'created_at', 'updated_at'
        ])
        expect(columnas.find(c => c.name === 'status')?.dflt_value).toBe("'libre'")
        expect(columnas.find(c => c.name === 'occupied_by')?.notnull).toBe(0)
    })

    it('impide dos mesas con el mismo número en el mismo restaurante', async () => {
        const now = new Date().toISOString()
        await dbConfig.run(
            `INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at)
             VALUES ('r-mig', 'R', 'C', 'r@x.com', '600000000', 'A', 'B', ?, ?)`, [now, now])
        const insertar = (id: string) => dbConfig.run(
            `INSERT INTO restaurant_tables (id, number, description, capacity, restaurant_id, created_at, updated_at)
             VALUES (?, 1, NULL, 4, 'r-mig', ?, ?)`, [id, now, now])
        await insertar('t-1')
        await expect(insertar('t-2')).rejects.toThrow(/UNIQUE/)
    })
})
