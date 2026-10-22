import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { setupTestDatabase, tokenFor, bearer, seedTwoRestaurants, createClient, insertTable, type SeededRestaurants } from '../test/http-helpers.js'

setupTestDatabase()

describe('mesas de staff (/api/v1/restaurants/:restaurantId/tables)', () => {
    let seed: SeededRestaurants
    let admin: string

    beforeAll(async () => {
        seed = await seedTwoRestaurants()
        admin = bearer(tokenFor({ role: 'admin' }))
    })

    it('está montado en app: sin token responde 401 y con admin 200', async () => {
        const url = `/api/v1/restaurants/${seed.restaurantA}/tables`
        expect((await request(app).get(url)).body).toEqual({ error: 'No autorizado: no se ha enviado el token' })
        expect((await request(app).get(url).set('Authorization', admin)).status).toBe(200)
    })

    describe('CRUD del admin', () => {
        const url = () => `/api/v1/restaurants/${seed.restaurantA}/tables`

        it('POST crea una mesa libre con la forma del contrato', async () => {
            const res = await request(app).post(url()).set('Authorization', admin).send({ number: 10, description: 'Terraza', capacity: 4 })
            expect(res.status).toBe(201)
            expect(Object.keys(res.body).sort()).toEqual(['capacity', 'createdAt', 'description', 'id', 'number', 'occupiedBy', 'restaurantId', 'status', 'updatedAt'])
            expect(res.body).toMatchObject({ number: 10, description: 'Terraza', capacity: 4, status: 'libre', occupiedBy: null, restaurantId: seed.restaurantA })
        })

        it('POST con número repetido -> 409 DuplicatedTableNumberError', async () => {
            await request(app).post(url()).set('Authorization', admin).send({ number: 11, capacity: 4 })
            const res = await request(app).post(url()).set('Authorization', admin).send({ number: 11, capacity: 2 })
            expect(res.status).toBe(409)
            expect(res.body).toEqual({ error: 'DuplicatedTableNumberError', message: 'Ya existe una mesa con ese número en el restaurante' })
        })

        it.each([
            [{ capacity: 4 }, 'InvalidTableNumberError', 'El número de mesa debe ser un entero mayor que 0'],
            [{ number: '12', capacity: 4 }, 'InvalidTableNumberError', 'El número de mesa debe ser un entero mayor que 0'],
            [{ number: 12 }, 'InvalidTableCapacityError', 'La capacidad debe ser un entero mayor que 0'],
            [{ number: 12, capacity: 0 }, 'InvalidTableCapacityError', 'La capacidad debe ser un entero mayor que 0'],
            [{ number: 12, capacity: 4, status: 'rota' }, 'InvalidTableStatusError', 'Estado inválido: rota. Debe ser uno de: libre, ocupada, reservada']
        ])('POST %j -> 400 %s', async (body, error, message) => {
            const res = await request(app).post(url()).set('Authorization', admin).send(body)
            expect(res.status).toBe(400)
            expect(res.body).toEqual({ error, message })
        })

        it('POST sin cuerpo -> 400 InvalidTableNumberError', async () => {
            const res = await request(app).post(url()).set('Authorization', admin)
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('InvalidTableNumberError')
        })

        it('PUT edita la mesa y sin number responde 400', async () => {
            const id = (await request(app).post(url()).set('Authorization', admin).send({ number: 13, capacity: 4 })).body.id
            const ok = await request(app).put(`${url()}/${id}`).set('Authorization', admin).send({ number: 14, description: 'Barra', capacity: 2, status: 'reservada' })
            expect(ok.status).toBe(200)
            expect(ok.body).toMatchObject({ id, number: 14, description: 'Barra', capacity: 2, status: 'reservada' })
            const ko = await request(app).put(`${url()}/${id}`).set('Authorization', admin).send({ capacity: 2 })
            expect(ko.status).toBe(400)
            expect(ko.body.error).toBe('InvalidTableNumberError')
        })

        it('DELETE de una mesa ocupada -> 409 y de una libre -> 204', async () => {
            const cliente = await createClient()
            const ocupada = await insertTable(seed.restaurantA, { number: 15, status: 'ocupada', occupiedBy: cliente.id })
            const libre = await insertTable(seed.restaurantA, { number: 16 })
            const ko = await request(app).delete(`${url()}/${ocupada}`).set('Authorization', admin)
            expect(ko.status).toBe(409)
            expect(ko.body).toEqual({ error: 'TableOccupiedError', message: 'No se puede eliminar una mesa ocupada' })
            expect((await request(app).delete(`${url()}/${libre}`).set('Authorization', admin)).status).toBe(204)
            expect((await request(app).get(`${url()}/${libre}`).set('Authorization', admin)).status).toBe(404)
        })

        it('GET lista ordenada por número', async () => {
            const res = await request(app).get(url()).set('Authorization', admin)
            const numeros = res.body.map((t: { number: number }) => t.number)
            expect(numeros).toEqual([...numeros].sort((a: number, b: number) => a - b))
        })
    })

    describe('roles', () => {
        let mesaA: string

        beforeAll(async () => {
            mesaA = await insertTable(seed.restaurantA, { number: 50 })
        })

        it('el cocinero ve las mesas pero no puede cambiar su estado', async () => {
            const cocinero = bearer(tokenFor({ role: 'cocinero', restaurantId: seed.restaurantA }))
            expect((await request(app).get(`/api/v1/restaurants/${seed.restaurantA}/tables`).set('Authorization', cocinero)).status).toBe(200)
            const res = await request(app).patch(`/api/v1/restaurants/${seed.restaurantA}/tables/${mesaA}/status`).set('Authorization', cocinero).send({ status: 'reservada' })
            expect(res.status).toBe(403)
            expect(res.body).toEqual({ error: 'Prohibido: permisos insuficientes' })
        })

        it('un cliente no accede a los endpoints de staff', async () => {
            const cliente = await createClient()
            expect((await request(app).get(`/api/v1/restaurants/${seed.restaurantA}/tables`).set('Authorization', cliente.auth)).status).toBe(403)
            expect((await request(app).patch(`/api/v1/restaurants/${seed.restaurantA}/tables/${mesaA}/status`).set('Authorization', cliente.auth).send({ status: 'libre' })).status).toBe(403)
        })

        it('manager y camarero no pueden crear, editar ni borrar', async () => {
            for (const role of ['manager', 'camarero']) {
                const token = bearer(tokenFor({ role, restaurantId: seed.restaurantA }))
                const base = `/api/v1/restaurants/${seed.restaurantA}/tables`
                expect((await request(app).post(base).set('Authorization', token).send({ number: 99, capacity: 2 })).status).toBe(403)
                expect((await request(app).put(`${base}/${mesaA}`).set('Authorization', token).send({ number: 50, capacity: 2 })).status).toBe(403)
                expect((await request(app).delete(`${base}/${mesaA}`).set('Authorization', token)).status).toBe(403)
            }
        })

        it.each(['camarero', 'manager'])('el %s libera una mesa ocupada por un cliente (occupiedBy a null)', async (role) => {
            const cliente = await createClient()
            const mesa = await insertTable(seed.restaurantA, { number: role === 'camarero' ? 51 : 52, status: 'ocupada', occupiedBy: cliente.id })
            const token = bearer(tokenFor({ role, restaurantId: seed.restaurantA }))
            const res = await request(app).patch(`/api/v1/restaurants/${seed.restaurantA}/tables/${mesa}/status`).set('Authorization', token).send({ status: 'libre' })
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: mesa, status: 'libre', occupiedBy: null })
        })

        it('PATCH con estado inválido -> 400', async () => {
            const camarero = bearer(tokenFor({ role: 'camarero', restaurantId: seed.restaurantA }))
            const res = await request(app).patch(`/api/v1/restaurants/${seed.restaurantA}/tables/${mesaA}/status`).set('Authorization', camarero).send({ status: 'rota' })
            expect(res.status).toBe(400)
            expect(res.body).toEqual({ error: 'InvalidTableStatusError', message: 'Estado inválido: rota. Debe ser uno de: libre, ocupada, reservada' })
        })
    })

    describe('aislamiento entre restaurantes', () => {
        let mesaB: string

        beforeAll(async () => {
            mesaB = await insertTable(seed.restaurantB, { number: 1 })
        })

        it('un empleado de A no accede a las mesas de B (403)', async () => {
            const managerA = bearer(tokenFor({ role: 'manager', restaurantId: seed.restaurantA }))
            expect((await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/tables`).set('Authorization', managerA)).status).toBe(403)
            expect((await request(app).patch(`/api/v1/restaurants/${seed.restaurantB}/tables/${mesaB}/status`).set('Authorization', managerA).send({ status: 'reservada' })).status).toBe(403)
        })

        it('una mesa de B pedida por la URL de A responde 404 y no cambia', async () => {
            const managerA = bearer(tokenFor({ role: 'manager', restaurantId: seed.restaurantA }))
            const res = await request(app).patch(`/api/v1/restaurants/${seed.restaurantA}/tables/${mesaB}/status`).set('Authorization', managerA).send({ status: 'reservada' })
            expect(res.status).toBe(404)
            expect(res.body).toEqual({ error: 'TableNotFoundError', message: 'Mesa no encontrada' })
            expect((await request(app).delete(`/api/v1/restaurants/${seed.restaurantA}/tables/${mesaB}`).set('Authorization', admin)).status).toBe(404)
            const b = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/tables/${mesaB}`).set('Authorization', admin)
            expect(b.body.status).toBe('libre')
        })
    })
})
