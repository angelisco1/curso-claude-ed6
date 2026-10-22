import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { setupTestDatabase, tokenFor, bearer, seedTwoRestaurants, createClient, type SeededRestaurants } from '../test/http-helpers.js'

// Recorrido de la verificación manual con curl del plan (sección 6), automatizado de principio a fin.
setupTestDatabase()

describe('flujo completo de mesas (plan de pruebas manual)', () => {
    let seed: SeededRestaurants
    let admin: string
    let cocinero: string
    let camarero: string
    let gerenteB: string
    let cliente: { id: string; auth: string }
    let otroCliente: { id: string; auth: string }
    let mesa10: string
    let mesa11: string
    let mesa12: string

    const staff = () => `/api/v1/restaurants/${seed.restaurantA}/tables`
    const publico = () => `/api/v1/public/restaurants/${seed.restaurantA}/tables`
    const pedido = (auth: string, tableId: string) =>
        request(app).post('/api/v1/orders').set('Authorization', auth)
            .send({ restaurantId: seed.restaurantA, tableId, items: [{ dishId: seed.dishA, quantity: 1, notes: null }] })

    beforeAll(async () => {
        seed = await seedTwoRestaurants()
        admin = bearer(tokenFor({ role: 'admin' }))
        cocinero = bearer(tokenFor({ role: 'cocinero', restaurantId: seed.restaurantA }))
        camarero = bearer(tokenFor({ role: 'camarero', restaurantId: seed.restaurantA }))
        gerenteB = bearer(tokenFor({ role: 'manager', restaurantId: seed.restaurantB }))
        cliente = await createClient()
        otroCliente = await createClient()
    })

    it('1. sin token -> 401 con el mensaje en español', async () => {
        const res = await request(app).get(staff())
        expect(res.status).toBe(401)
        expect(res.body).toEqual({ error: 'No autorizado: no se ha enviado el token' })
    })

    it('2. el admin crea mesas; número repetido -> 409; capacidad 0 -> 400; cocinero -> 403', async () => {
        const creada = await request(app).post(staff()).set('Authorization', admin).send({ number: 10, description: 'Terraza', capacity: 4 })
        expect(creada.status).toBe(201)
        mesa10 = creada.body.id
        mesa11 = (await request(app).post(staff()).set('Authorization', admin).send({ number: 11, capacity: 2 })).body.id
        mesa12 = (await request(app).post(staff()).set('Authorization', admin).send({ number: 12, capacity: 6 })).body.id

        expect((await request(app).post(staff()).set('Authorization', admin).send({ number: 10, capacity: 4 })).status).toBe(409)
        expect((await request(app).post(staff()).set('Authorization', admin).send({ number: 13, capacity: 0 })).status).toBe(400)
        expect((await request(app).post(staff()).set('Authorization', cocinero).send({ number: 13, capacity: 2 })).status).toBe(403)
    })

    it('3. disponibles sin token: solo libres con capacidad >= 3; people=abc -> 400', async () => {
        const res = await request(app).get(`${publico()}/available?people=3`)
        expect(res.status).toBe(200)
        expect(res.body.map((t: { number: number }) => t.number)).toEqual([10, 12])
        expect((await request(app).get(`${publico()}/available?people=abc`)).status).toBe(400)
    })

    it('4. el cliente ocupa una mesa; otra -> 409; /mine -> 200', async () => {
        expect((await request(app).post(`${publico()}/${mesa10}/occupy`).set('Authorization', cliente.auth)).status).toBe(200)
        const otra = await request(app).post(`${publico()}/${mesa11}/occupy`).set('Authorization', cliente.auth)
        expect(otra.status).toBe(409)
        expect(otra.body.message).toBe('Ya tienes una mesa ocupada')
        const mine = await request(app).get(`${publico()}/mine`).set('Authorization', cliente.auth)
        expect(mine.status).toBe(200)
        expect(mine.body.id).toBe(mesa10)
    })

    it('5. pedido con su mesa -> 201; con mesa de otro cliente -> 403; con mesa libre -> 409', async () => {
        expect((await pedido(cliente.auth, mesa10)).status).toBe(201)
        await request(app).post(`${publico()}/${mesa12}/occupy`).set('Authorization', otroCliente.auth)
        expect((await pedido(cliente.auth, mesa12)).status).toBe(403)
        expect((await pedido(cliente.auth, mesa11)).status).toBe(409)
    })

    it('6. el personal ve la mesa ocupada con occupiedBy y su pedido en activos', async () => {
        const mesa = await request(app).get(`${staff()}/${mesa10}`).set('Authorization', camarero)
        expect(mesa.body).toMatchObject({ status: 'ocupada', occupiedBy: cliente.id })
        const activos = await request(app).get('/api/v1/orders/active').set('Authorization', camarero)
        expect(activos.body.some((o: { tableId: string }) => o.tableId === mesa10)).toBe(true)
    })

    it('7. el camarero libera la mesa (occupiedBy null) y el cliente ya puede ocupar otra; el cocinero no puede', async () => {
        expect((await request(app).patch(`${staff()}/${mesa10}/status`).set('Authorization', cocinero).send({ status: 'libre' })).status).toBe(403)
        const liberada = await request(app).patch(`${staff()}/${mesa10}/status`).set('Authorization', camarero).send({ status: 'libre' })
        expect(liberada.status).toBe(200)
        expect(liberada.body).toMatchObject({ status: 'libre', occupiedBy: null })
        expect((await request(app).post(`${publico()}/${mesa11}/occupy`).set('Authorization', cliente.auth)).status).toBe(200)
    })

    it('8. el admin no borra una mesa ocupada (409) pero sí una libre (204); un gerente de B -> 403', async () => {
        expect((await request(app).delete(`${staff()}/${mesa11}`).set('Authorization', admin)).status).toBe(409)
        expect((await request(app).delete(`${staff()}/${mesa10}`).set('Authorization', admin)).status).toBe(204)
        expect((await request(app).get(staff()).set('Authorization', gerenteB)).status).toBe(403)
    })
})
