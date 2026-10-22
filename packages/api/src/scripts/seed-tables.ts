import type { Database } from '@config/database.js'

/** Mesa de rest-1 que el seed deja ocupada (por el personal) y usa en el pedido de ejemplo. */
export const SEED_OCCUPIED_TABLE_ID = 'mesa-rest-1-3'

const TABLES = [
    { id: 'mesa-rest-1-1', restaurantId: 'rest-1', number: 1, description: 'Junto a la ventana', capacity: 2, status: 'libre' },
    { id: 'mesa-rest-1-2', restaurantId: 'rest-1', number: 2, description: null, capacity: 4, status: 'libre' },
    { id: SEED_OCCUPIED_TABLE_ID, restaurantId: 'rest-1', number: 3, description: 'Terraza', capacity: 4, status: 'ocupada' },
    { id: 'mesa-rest-1-4', restaurantId: 'rest-1', number: 4, description: 'Salón privado', capacity: 8, status: 'reservada' },
    { id: 'mesa-rest-1-5', restaurantId: 'rest-1', number: 5, description: null, capacity: 6, status: 'libre' },
    { id: 'mesa-rest-2-1', restaurantId: 'rest-2', number: 1, description: null, capacity: 2, status: 'libre' },
    { id: 'mesa-rest-2-2', restaurantId: 'rest-2', number: 2, description: 'Junto a la barra', capacity: 4, status: 'reservada' },
    { id: 'mesa-rest-2-3', restaurantId: 'rest-2', number: 3, description: null, capacity: 6, status: 'libre' }
]

/** Inserta las mesas de ejemplo de rest-1 y rest-2 (idempotente: INSERT OR IGNORE). */
export const seedTables = async (db: Database): Promise<void> => {
    const now = new Date().toISOString()
    for (const t of TABLES) {
        await db.run(`
            INSERT OR IGNORE INTO restaurant_tables (id, number, description, capacity, status, occupied_by, restaurant_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [t.id, t.number, t.description, t.capacity, t.status, null, t.restaurantId, now, now])
    }
}
