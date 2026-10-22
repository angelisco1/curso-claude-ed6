import { afterAll, beforeAll } from 'vitest'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { dbConfig } from '@config/database.js'
import { getJwtSecret, JWT_ALGORITHM } from '@config/jwt.js'

/**
 * Inicializa la BD en memoria (NODE_ENV=test) antes de los tests del archivo
 * y la cierra al terminar. Llamar una vez en el cuerpo del archivo de test.
 */
export const setupTestDatabase = (): void => {
    beforeAll(async () => {
        await dbConfig.initialize()
    })
    afterAll(async () => {
        await dbConfig.close()
    })
}

export interface TokenOptions {
    role: string
    restaurantId?: string | null
    id?: string
}

/** Firma un access token válido con el secreto de test. */
export const tokenFor = ({ role, restaurantId = null, id = randomUUID() }: TokenOptions): string =>
    jwt.sign({ id, role, restaurantId }, getJwtSecret(), { algorithm: JWT_ALGORITHM, expiresIn: '15m' })

/** Valor de la cabecera `Authorization` para un token. */
export const bearer = (token: string): string => `Bearer ${token}`

export interface SeededRestaurants {
    restaurantA: string
    restaurantB: string
    dishA: string
    dishB: string
    ingredientA: string
    ingredientB: string
}

const insertRestaurant = async (id: string, name: string): Promise<void> => {
    const now = new Date().toISOString()
    await dbConfig.run(
        `INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, 'Calle Falsa 123', `${id}@test.com`, '600000000', 'Dueño', 'Prueba', now, now]
    )
}

const insertDish = async (restaurantId: string): Promise<string> => {
    const id = randomUUID()
    const now = new Date().toISOString()
    await dbConfig.run(
        `INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, 'Plato de prueba', null, 10, 'principal', 1, restaurantId, now, now]
    )
    return id
}

const insertIngredient = async (restaurantId: string): Promise<string> => {
    const id = randomUUID()
    const now = new Date().toISOString()
    await dbConfig.run(
        `INSERT INTO ingredients (id, name, unit, current_stock, restaurant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, 'Ingrediente de prueba', 'kg', 5, restaurantId, now, now]
    )
    return id
}

/** Crea dos restaurantes (A y B), cada uno con un plato y un ingrediente. Devuelve sus ids. */
export const seedTwoRestaurants = async (): Promise<SeededRestaurants> => {
    const restaurantA = `rest-a-${randomUUID()}`
    const restaurantB = `rest-b-${randomUUID()}`
    await insertRestaurant(restaurantA, 'Restaurante A')
    await insertRestaurant(restaurantB, 'Restaurante B')
    return {
        restaurantA,
        restaurantB,
        dishA: await insertDish(restaurantA),
        dishB: await insertDish(restaurantB),
        ingredientA: await insertIngredient(restaurantA),
        ingredientB: await insertIngredient(restaurantB)
    }
}

/**
 * Inserta un cliente en `employees` (la ocupación de mesas tiene FK a esa tabla)
 * y devuelve su id y la cabecera `Authorization` lista para usar.
 */
export const createClient = async (): Promise<{ id: string; auth: string }> => {
    const id = randomUUID()
    await dbConfig.run(
        'INSERT INTO employees (id, first_name, last_name, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, 'Cliente', 'Prueba', `${id}@test.com`, 'hash', 'cliente', null]
    )
    return { id, auth: bearer(tokenFor({ role: 'cliente', id })) }
}

/** Inserta una mesa directamente en la BD y devuelve su id. */
export const insertTable = async (
    restaurantId: string,
    props: { number: number; capacity?: number; status?: string; occupiedBy?: string | null }
): Promise<string> => {
    const id = randomUUID()
    const now = new Date().toISOString()
    await dbConfig.run(
        `INSERT INTO restaurant_tables (id, number, description, capacity, status, occupied_by, restaurant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, props.number, null, props.capacity ?? 4, props.status ?? 'libre', props.occupiedBy ?? null, restaurantId, now, now]
    )
    return id
}
