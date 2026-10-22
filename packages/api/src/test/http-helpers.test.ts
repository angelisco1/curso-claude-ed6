import { describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'
import { dbConfig } from '@config/database.js'
import { getJwtSecret } from '@config/jwt.js'
import { setupTestDatabase, tokenFor, bearer, seedTwoRestaurants } from './http-helpers.js'

setupTestDatabase()

describe('http-helpers', () => {
    it('tokenFor firma un token verificable con id, role y restaurantId', () => {
        const token = tokenFor({ role: 'manager', restaurantId: 'r1' })
        const payload = jwt.verify(token, getJwtSecret()) as Record<string, unknown>
        expect(payload).toMatchObject({ role: 'manager', restaurantId: 'r1' })
        expect(typeof payload.id).toBe('string')
    })

    it('tokenFor usa restaurantId null por defecto', () => {
        const payload = jwt.decode(tokenFor({ role: 'admin' })) as Record<string, unknown>
        expect(payload.restaurantId).toBeNull()
    })

    it('bearer devuelve el valor de la cabecera Authorization', () => {
        expect(bearer('abc')).toBe('Bearer abc')
    })

    it('seedTwoRestaurants crea dos restaurantes con un plato y un ingrediente cada uno', async () => {
        const seed = await seedTwoRestaurants()
        const dish = await dbConfig.get<{ restaurant_id: string }>('SELECT restaurant_id FROM dishes WHERE id = ?', [seed.dishB])
        const ing = await dbConfig.get<{ restaurant_id: string }>('SELECT restaurant_id FROM ingredients WHERE id = ?', [seed.ingredientA])
        expect(dish?.restaurant_id).toBe(seed.restaurantB)
        expect(ing?.restaurant_id).toBe(seed.restaurantA)
    })
})
