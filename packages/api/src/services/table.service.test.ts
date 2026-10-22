import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    RestaurantIdRequiredError,
    DuplicatedTableNumberError,
    TableNotFoundError,
    TableOccupiedError,
    InvalidPeopleCountError,
    ClientAlreadyHasTableError,
    TableNotAvailableError
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

    describe('findById y findByRestaurantId', () => {
        it('devuelve la mesa si es del restaurante', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            expect(await service.findById('A', table.id)).toEqual(table)
        })

        it('lanza TableNotFoundError si no existe o es de otro restaurante', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await expect(service.findById('B', table.id)).rejects.toThrow(TableNotFoundError)
            await expect(service.findById('A', 'no-existe')).rejects.toThrow('Mesa no encontrada')
        })

        it('lista solo las mesas del restaurante ordenadas por número', async () => {
            await service.create({ number: 2, capacity: 4, restaurantId: 'A' })
            await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await service.create({ number: 1, capacity: 4, restaurantId: 'B' })
            expect((await service.findByRestaurantId('A')).map(t => t.number)).toEqual([1, 2])
        })
    })

    describe('update', () => {
        const ocupadaPorCliente = async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await repo.occupyIfFree('A', table.id, 'cliente-1')
            return table
        }

        it('reemplaza los campos editables y conserva id, restaurante y createdAt', async () => {
            const table = await service.create({ number: 1, description: 'Ventana', capacity: 4, restaurantId: 'A' })
            const updated = await service.update('A', table.id, { number: 3, capacity: 6 })
            expect(updated).toMatchObject({ id: table.id, number: 3, description: null, capacity: 6, status: 'libre', restaurantId: 'A', createdAt: table.createdAt })
            expect(await repo.findById(table.id)).toEqual(updated)
        })

        it('sin status conserva el estado y el ocupante', async () => {
            const table = await ocupadaPorCliente()
            const updated = await service.update('A', table.id, { number: 1, capacity: 8 })
            expect(updated).toMatchObject({ status: 'ocupada', occupiedBy: 'cliente-1', capacity: 8 })
        })

        it('con el mismo status conserva el ocupante', async () => {
            const table = await ocupadaPorCliente()
            const updated = await service.update('A', table.id, { number: 1, capacity: 4, status: 'ocupada' })
            expect(updated.occupiedBy).toBe('cliente-1')
        })

        it('si cambia el status deja occupiedBy a null', async () => {
            const table = await ocupadaPorCliente()
            const updated = await service.update('A', table.id, { number: 1, capacity: 4, status: 'reservada' })
            expect(updated).toMatchObject({ status: 'reservada', occupiedBy: null })
        })

        it('permite conservar su propio número pero no usar el de otra mesa', async () => {
            const t1 = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await service.create({ number: 2, capacity: 4, restaurantId: 'A' })
            await expect(service.update('A', t1.id, { number: 1, capacity: 2 })).resolves.toMatchObject({ number: 1 })
            await expect(service.update('A', t1.id, { number: 2, capacity: 2 })).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('valida los campos y el aislamiento por restaurante', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await expect(service.update('A', table.id, { capacity: 4 } as never)).rejects.toThrow(InvalidTableNumberError)
            await expect(service.update('A', table.id, { number: 1 } as never)).rejects.toThrow(InvalidTableCapacityError)
            await expect(service.update('A', table.id, { number: 1, capacity: 4, status: 'rota' })).rejects.toThrow(InvalidTableStatusError)
            await expect(service.update('B', table.id, { number: 1, capacity: 4 })).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('delete', () => {
        it('elimina una mesa libre o reservada', async () => {
            const libre = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            const reservada = await service.create({ number: 2, capacity: 4, status: 'reservada', restaurantId: 'A' })
            await service.delete('A', libre.id)
            await service.delete('A', reservada.id)
            expect(await repo.findById(libre.id)).toBeNull()
            expect(await repo.findById(reservada.id)).toBeNull()
        })

        it('rechaza eliminar una mesa ocupada', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await repo.occupyIfFree('A', table.id, 'cliente-1')
            await expect(service.delete('A', table.id)).rejects.toThrow(TableOccupiedError)
            expect(await repo.findById(table.id)).not.toBeNull()
        })

        it('no elimina mesas de otro restaurante', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await expect(service.delete('B', table.id)).rejects.toThrow(TableNotFoundError)
            expect(await repo.findById(table.id)).not.toBeNull()
        })
    })

    describe('updateStatus', () => {
        it('liberar una mesa ocupada suelta al cliente, que puede ocupar otra', async () => {
            const t1 = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            const t2 = await service.create({ number: 2, capacity: 4, restaurantId: 'A' })
            await repo.occupyIfFree('A', t1.id, 'cliente-1')

            const liberada = await service.updateStatus('A', t1.id, 'libre')

            expect(liberada).toMatchObject({ status: 'libre', occupiedBy: null })
            expect(await repo.findById(t1.id)).toEqual(liberada)
            expect(await repo.occupyIfFree('A', t2.id, 'cliente-1')).toBe(true)
        })

        it('siempre deja occupiedBy a null, también si el estado no cambia', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await repo.occupyIfFree('A', table.id, 'cliente-1')
            const result = await service.updateStatus('A', table.id, 'ocupada')
            expect(result).toMatchObject({ status: 'ocupada', occupiedBy: null })
        })

        it('normaliza el estado y conserva el resto de campos', async () => {
            const table = await service.create({ number: 5, description: 'Terraza', capacity: 6, restaurantId: 'A' })
            const result = await service.updateStatus('A', table.id, ' RESERVADA ')
            expect(result).toMatchObject({ number: 5, description: 'Terraza', capacity: 6, status: 'reservada', createdAt: table.createdAt })
        })

        it('rechaza estados inválidos o ausentes y mesas de otro restaurante', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await expect(service.updateStatus('A', table.id, 'rota')).rejects.toThrow(InvalidTableStatusError)
            await expect(service.updateStatus('A', table.id, undefined as unknown as string)).rejects.toThrow(InvalidTableStatusError)
            await expect(service.updateStatus('B', table.id, 'libre')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findAvailable', () => {
        beforeEach(async () => {
            await service.create({ number: 1, capacity: 6, restaurantId: 'A' })
            await service.create({ number: 2, capacity: 2, restaurantId: 'A' })
            await service.create({ number: 3, capacity: 4, status: 'reservada', restaurantId: 'A' })
        })

        it('devuelve las mesas libres con capacidad suficiente, aceptando number o texto', async () => {
            expect((await service.findAvailable('A', 3)).map(t => t.number)).toEqual([1])
            expect((await service.findAvailable('A', '2')).map(t => t.number)).toEqual([2, 1])
        })

        it('devuelve [] para un restaurante sin mesas', async () => {
            expect(await service.findAvailable('no-existe', 2)).toEqual([])
        })

        it.each([0, -1, 2.5, '0', '2.5', 'abc', '', ' 3', '3abc', undefined, null])('rechaza people = %s', async (people) => {
            await expect(service.findAvailable('A', people)).rejects.toThrow(InvalidPeopleCountError)
        })
    })

    describe('findMine', () => {
        it('devuelve la mesa que ocupa el cliente en ese restaurante', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await repo.occupyIfFree('A', table.id, 'cliente-1')
            expect((await service.findMine('A', 'cliente-1')).id).toBe(table.id)
        })

        it('lanza TableNotFoundError si no ocupa ninguna o la ocupa en otro restaurante', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            await repo.occupyIfFree('A', table.id, 'cliente-1')
            await expect(service.findMine('B', 'cliente-1')).rejects.toThrow(TableNotFoundError)
            await expect(service.findMine('A', 'cliente-2')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('occupy', () => {
        let t1: Awaited<ReturnType<TableService['create']>>
        let t2: Awaited<ReturnType<TableService['create']>>

        beforeEach(async () => {
            t1 = await service.create({ number: 1, capacity: 4, restaurantId: 'A' })
            t2 = await service.create({ number: 2, capacity: 4, restaurantId: 'A' })
        })

        it('ocupa una mesa libre y la asocia al cliente', async () => {
            const table = await service.occupy('A', t1.id, 'cliente-1')
            expect(table).toMatchObject({ id: t1.id, status: 'ocupada', occupiedBy: 'cliente-1' })
        })

        it('es idempotente si el cliente ya ocupa esa mesa', async () => {
            await service.occupy('A', t1.id, 'cliente-1')
            const again = await service.occupy('A', t1.id, 'cliente-1')
            expect(again).toMatchObject({ id: t1.id, status: 'ocupada', occupiedBy: 'cliente-1' })
        })

        it('rechaza ocupar una segunda mesa (también en otro restaurante)', async () => {
            const enB = await service.create({ number: 1, capacity: 4, restaurantId: 'B' })
            await service.occupy('A', t1.id, 'cliente-1')
            await expect(service.occupy('A', t2.id, 'cliente-1')).rejects.toThrow(ClientAlreadyHasTableError)
            await expect(service.occupy('B', enB.id, 'cliente-1')).rejects.toThrow('Ya tienes una mesa ocupada')
            expect((await repo.findById(t2.id))?.status).toBe('libre')
        })

        it('rechaza una mesa ocupada por otro cliente o reservada', async () => {
            await service.occupy('A', t1.id, 'cliente-1')
            await expect(service.occupy('A', t1.id, 'cliente-2')).rejects.toThrow(TableNotAvailableError)
            await service.updateStatus('A', t2.id, 'reservada')
            await expect(service.occupy('A', t2.id, 'cliente-2')).rejects.toThrow('La mesa ya no está disponible')
        })

        it('lanza TableNotFoundError si la mesa no existe o es de otro restaurante', async () => {
            await expect(service.occupy('B', t1.id, 'cliente-1')).rejects.toThrow(TableNotFoundError)
            await expect(service.occupy('A', 'no-existe', 'cliente-1')).rejects.toThrow(TableNotFoundError)
        })

        it('si pierde una carrera porque el cliente ocupó otra mesa a la vez, responde ClientAlreadyHasTableError', async () => {
            vi.spyOn(repo, 'occupyIfFree').mockImplementationOnce(async () => {
                await repo.save({ ...t2, status: 'ocupada', occupiedBy: 'cliente-1' })
                return false
            })
            await expect(service.occupy('A', t1.id, 'cliente-1')).rejects.toThrow(ClientAlreadyHasTableError)
        })

        it('si pierde una carrera porque otro cliente ocupó la mesa, responde TableNotAvailableError', async () => {
            vi.spyOn(repo, 'occupyIfFree').mockResolvedValueOnce(false)
            await expect(service.occupy('A', t1.id, 'cliente-1')).rejects.toThrow(TableNotAvailableError)
        })
    })
})
