import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'

interface TableRow {
    id: string
    number: number
    description: string | null
    capacity: number
    status: string
    occupiedBy: string | null
    restaurantId: string
    createdAt: string
    updatedAt: string
}

const SELECT_TABLE = `SELECT id, number, description, capacity, status, occupied_by as occupiedBy, restaurant_id as restaurantId,
    created_at as createdAt, updated_at as updatedAt FROM restaurant_tables`

export interface TableRepository {
    findById(id: string): Promise<Table | null>
    findByRestaurantId(restaurantId: string): Promise<Table[]>
    findByNumber(restaurantId: string, number: number): Promise<Table | null>
    save(table: Table): Promise<void>
    delete(id: string): Promise<void>
}

export class SqliteTableRepository implements TableRepository {
    constructor(private db: Database) {}

    async findById(id: string): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`${SELECT_TABLE} WHERE id = ?`, [id])
        if (!row) return null
        return this.mapToTable(row)
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(`${SELECT_TABLE} WHERE restaurant_id = ? ORDER BY number ASC`, [restaurantId])
        return rows.map(row => this.mapToTable(row))
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`${SELECT_TABLE} WHERE restaurant_id = ? AND number = ?`, [restaurantId, number])
        if (!row) return null
        return this.mapToTable(row)
    }

    async save(table: Table): Promise<void> {
        const existing = await this.findById(table.id)
        if (existing) {
            await this.db.run(
                'UPDATE restaurant_tables SET number = ?, description = ?, capacity = ?, status = ?, occupied_by = ?, updated_at = ? WHERE id = ?',
                [table.number, table.description, table.capacity, table.status, table.occupiedBy, table.updatedAt, table.id]
            )
        } else {
            await this.db.run(
                `INSERT INTO restaurant_tables (id, number, description, capacity, status, occupied_by, restaurant_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [table.id, table.number, table.description, table.capacity, table.status, table.occupiedBy, table.restaurantId, table.createdAt, table.updatedAt]
            )
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.run('DELETE FROM restaurant_tables WHERE id = ?', [id])
    }

    private mapToTable(row: TableRow): Table {
        return {
            id: row.id,
            number: row.number,
            description: row.description,
            capacity: row.capacity,
            status: normalizeTableStatus(row.status),
            occupiedBy: row.occupiedBy,
            restaurantId: row.restaurantId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }
}
