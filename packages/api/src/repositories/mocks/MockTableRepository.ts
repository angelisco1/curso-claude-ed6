import type { TableRepository } from '@repositories/table.repository.js'
import type { Table } from '@models/table.model.js'

export class MockTableRepository implements TableRepository {
    private tables: Map<string, Table> = new Map()

    async findById(id: string): Promise<Table | null> {
        const table = this.tables.get(id)
        return table ? { ...table } : null
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        return this.all()
            .filter(t => t.restaurantId === restaurantId)
            .sort((a, b) => a.number - b.number)
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        return this.all().find(t => t.restaurantId === restaurantId && t.number === number) ?? null
    }

    async findAvailable(restaurantId: string, people: number): Promise<Table[]> {
        return this.all()
            .filter(t => t.restaurantId === restaurantId && t.status === 'libre' && t.capacity >= people)
            .sort((a, b) => a.capacity - b.capacity || a.number - b.number)
    }

    async findByOccupant(clientId: string): Promise<Table | null> {
        return this.all().find(t => t.occupiedBy === clientId) ?? null
    }

    async occupyIfFree(restaurantId: string, id: string, clientId: string): Promise<boolean> {
        const table = this.tables.get(id)
        if (!table || table.restaurantId !== restaurantId || table.status !== 'libre') return false
        if (await this.findByOccupant(clientId)) return false
        this.tables.set(id, { ...table, status: 'ocupada', occupiedBy: clientId, updatedAt: new Date().toISOString() })
        return true
    }

    async save(table: Table): Promise<void> {
        this.tables.set(table.id, { ...table })
    }

    async delete(id: string): Promise<void> {
        this.tables.delete(id)
    }

    private all(): Table[] {
        return Array.from(this.tables.values()).map(t => ({ ...t }))
    }
}
