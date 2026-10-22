import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    RestaurantIdRequiredError,
    DuplicatedTableNumberError
} from '@errors/DomainErrors.js'

describe('TableService', () => {
    let repo: MockTableRepository
    let service: TableService

    beforeEach(() => {
        repo = new MockTableRepository()
        service = new TableService(repo)
    })

    describe('create', () => {
        const base = { number: 1, description: 'Junto a la ventana', capacity: 4, restaurantId: 'A' }

        it('crea una mesa libre por defecto, sin ocupante, y la guarda', async () => {
            const table = await service.create(base)
            expect(table).toMatchObject({ number: 1, description: 'Junto a la ventana', capacity: 4, status: 'libre', occupiedBy: null, restaurantId: 'A' })
            expect(table.id).toBeTruthy()
            expect(table.createdAt).toBe(table.updatedAt)
            expect(await repo.findById(table.id)).toEqual(table)
        })

        it('guarda como null una descripción ausente, vacía o solo con espacios', async () => {
            expect((await service.create({ number: 1, capacity: 2, restaurantId: 'A' })).description).toBeNull()
            expect((await service.create({ ...base, number: 2, description: '   ' })).description).toBeNull()
            expect((await service.create({ ...base, number: 3, description: null })).description).toBeNull()
        })

        it('acepta un estado inicial y lo normaliza, pero nunca asigna ocupante', async () => {
            const table = await service.create({ ...base, status: ' OCUPADA ' })
            expect(table.status).toBe('ocupada')
            expect(table.occupiedBy).toBeNull()
        })

        it.each([0, -1, 2.5, '4', undefined, null])('rechaza el número %s', async (number) => {
            await expect(service.create({ ...base, number: number as number })).rejects.toThrow(InvalidTableNumberError)
        })

        it.each([0, -3, 1.5, '4', undefined, null])('rechaza la capacidad %s', async (capacity) => {
            await expect(service.create({ ...base, capacity: capacity as number })).rejects.toThrow(InvalidTableCapacityError)
        })

        it('rechaza un estado inválido', async () => {
            await expect(service.create({ ...base, status: 'rota' })).rejects.toThrow('Estado inválido: rota. Debe ser uno de: libre, ocupada, reservada')
            await expect(service.create({ ...base, status: 'rota' })).rejects.toThrow(InvalidTableStatusError)
        })

        it('exige el restaurantId', async () => {
            await expect(service.create({ ...base, restaurantId: ' ' })).rejects.toThrow(RestaurantIdRequiredError)
        })

        it('rechaza un número repetido en el restaurante, pero no en otro', async () => {
            await service.create(base)
            await expect(service.create(base)).rejects.toThrow(DuplicatedTableNumberError)
            await expect(service.create({ ...base, restaurantId: 'B' })).resolves.toMatchObject({ restaurantId: 'B' })
        })
    })
})
