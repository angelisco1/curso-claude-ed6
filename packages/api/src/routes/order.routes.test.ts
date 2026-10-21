import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'crypto'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { setupTestDatabase, tokenFor, bearer, seedTwoRestaurants, type SeededRestaurants } from '../test/http-helpers.js'

setupTestDatabase()

const insertOrder = async (restaurantId: string, dishId: string, clientId: string | null): Promise<{ orderId: string; itemId: string }> => {
    const orderId = randomUUID()
    const itemId = randomUUID()
    await dbConfig.run(
        'INSERT INTO orders (id, restaurant_id, table_id, client_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [orderId, restaurantId, null, clientId, new Date().toISOString()]
    )
    await dbConfig.run(
        'INSERT INTO order_items (id, order_id, dish_id, quantity, notes, status) VALUES (?, ?, ?, ?, ?, ?)',
        [itemId, orderId, dishId, 1, null, 'pendiente']
    )
    return { orderId, itemId }
}

describe('autorización de pedidos', () => {
    let seed: SeededRestaurants
    let orderA: { orderId: string; itemId: string }
    let orderB: { orderId: string; itemId: string }
    const clienteId = randomUUID()
    let cliente: string
    let otroCliente: string
    let cocineroA: string
    let cocineroB: string
    let admin: string

    beforeAll(async () => {
        seed = await seedTwoRestaurants()
        orderA = await insertOrder(seed.restaurantA, seed.dishA, clienteId)
        orderB = await insertOrder(seed.restaurantB, seed.dishB, randomUUID())
        cliente = bearer(tokenFor({ role: 'cliente', id: clienteId }))
        otroCliente = bearer(tokenFor({ role: 'cliente' }))
        cocineroA = bearer(tokenFor({ role: 'cocinero', restaurantId: seed.restaurantA }))
        cocineroB = bearer(tokenFor({ role: 'cocinero', restaurantId: seed.restaurantB }))
        admin = bearer(tokenFor({ role: 'admin' }))
    })

    describe('cliente', () => {
        it('GET /orders/active -> 403', async () => {
            const res = await request(app).get(`/api/v1/orders/active?restaurantId=${seed.restaurantA}`).set('Authorization', cliente)
            expect(res.status).toBe(403)
        })

        it('PATCH de estado de un ítem -> 403 y no cambia el estado', async () => {
            const res = await request(app)
                .patch(`/api/v1/orders/${orderA.orderId}/items/${orderA.itemId}/status`)
                .set('Authorization', cliente)
                .send({ status: 'entregado' })
            expect(res.status).toBe(403)
            const fila = await dbConfig.all<{ status: string }>('SELECT status FROM order_items WHERE id = ?', [orderA.itemId])
            expect(fila[0]?.status).toBe('pendiente')
        })

        it('GET /orders/:id de un pedido ajeno -> 404', async () => {
            const res = await request(app).get(`/api/v1/orders/${orderA.orderId}`).set('Authorization', otroCliente)
            expect(res.status).toBe(404)
        })

        it('GET /orders/:id de un pedido propio -> 200', async () => {
            const res = await request(app).get(`/api/v1/orders/${orderA.orderId}`).set('Authorization', cliente)
            expect(res.status).toBe(200)
        })

        it('GET /orders/mine sigue funcionando', async () => {
            const res = await request(app).get('/api/v1/orders/mine').set('Authorization', cliente)
            expect(res.status).toBe(200)
            expect(res.body).toHaveLength(1)
        })
    })

    describe('empleado de B sobre pedidos de A', () => {
        it('GET /orders/active?restaurantId=A devuelve solo pedidos de B', async () => {
            const res = await request(app).get(`/api/v1/orders/active?restaurantId=${seed.restaurantA}`).set('Authorization', cocineroB)
            expect(res.status).toBe(200)
            expect(res.body.map((o: { id: string }) => o.id)).toEqual([orderB.orderId])
        })

        it('GET /orders/:id de un pedido de A -> 404', async () => {
            const res = await request(app).get(`/api/v1/orders/${orderA.orderId}`).set('Authorization', cocineroB)
            expect(res.status).toBe(404)
        })

        it('PATCH de un ítem de A -> 404 y no cambia el estado', async () => {
            const res = await request(app)
                .patch(`/api/v1/orders/${orderA.orderId}/items/${orderA.itemId}/status`)
                .set('Authorization', cocineroB)
                .send({ status: 'entregado' })
            expect(res.status).toBe(404)
            const fila = await dbConfig.all<{ status: string }>('SELECT status FROM order_items WHERE id = ?', [orderA.itemId])
            expect(fila[0]?.status).toBe('pendiente')
        })
    })

    describe('accesos legítimos', () => {
        it('cocinero de A ve los pedidos activos de A', async () => {
            const res = await request(app).get('/api/v1/orders/active').set('Authorization', cocineroA)
            expect(res.status).toBe(200)
            expect(res.body.map((o: { id: string }) => o.id)).toEqual([orderA.orderId])
        })

        it('admin ve los pedidos de cualquier restaurante y exige restaurantId', async () => {
            const res = await request(app).get(`/api/v1/orders/active?restaurantId=${seed.restaurantB}`).set('Authorization', admin)
            expect(res.status).toBe(200)
            expect(res.body.map((o: { id: string }) => o.id)).toEqual([orderB.orderId])
            const sin = await request(app).get('/api/v1/orders/active').set('Authorization', admin)
            expect(sin.status).toBe(400)
        })

        it('cocinero de A actualiza el estado de un ítem de A', async () => {
            const res = await request(app)
                .patch(`/api/v1/orders/${orderA.orderId}/items/${orderA.itemId}/status`)
                .set('Authorization', cocineroA)
                .send({ status: 'preparando' })
            expect(res.status).toBe(204)
        })
    })
})
