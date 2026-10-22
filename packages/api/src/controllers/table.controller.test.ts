import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { TableController } from './table.controller.js'
import type { TableService } from '@services/table.service.js'
import type { Table } from '@models/table.model.js'

const mesa: Table = {
    id: 't1',
    number: 1,
    description: 'Ventana',
    capacity: 4,
    status: 'ocupada',
    occupiedBy: 'cliente-1',
    restaurantId: 'A',
    createdAt: '2026-10-22T10:00:00.000Z',
    updatedAt: '2026-10-22T10:00:00.000Z'
}

function setup() {
    const service = {
        create: vi.fn().mockResolvedValue(mesa),
        findByRestaurantId: vi.fn().mockResolvedValue([mesa]),
        findById: vi.fn().mockResolvedValue(mesa),
        update: vi.fn().mockResolvedValue(mesa),
        delete: vi.fn().mockResolvedValue(undefined),
        updateStatus: vi.fn().mockResolvedValue(mesa),
        findAvailable: vi.fn().mockResolvedValue([mesa]),
        findMine: vi.fn().mockResolvedValue(mesa),
        occupy: vi.fn().mockResolvedValue(mesa)
    }
    const controller = new TableController(service as unknown as TableService)
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() } as unknown as Response
    const next = vi.fn()
    return { service, controller, res, next }
}

const req = (extra: object) => ({ params: {}, query: {}, body: {}, ...extra }) as unknown as Request

describe('TableController (staff)', () => {
    it('create pasa el cuerpo y el restaurantId de la ruta y responde 201 con occupiedBy', async () => {
        const { service, controller, res, next } = setup()
        await controller.create(req({ params: { restaurantId: 'A' }, body: { number: 1, description: 'Ventana', capacity: 4, status: 'libre' } }), res, next)
        expect(service.create).toHaveBeenCalledWith({ number: 1, description: 'Ventana', capacity: 4, status: 'libre', restaurantId: 'A' })
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.json).toHaveBeenCalledWith(mesa)
    })

    it('getAll responde 200 con las mesas del restaurante', async () => {
        const { service, controller, res, next } = setup()
        await controller.getAll(req({ params: { restaurantId: 'A' } }), res, next)
        expect(service.findByRestaurantId).toHaveBeenCalledWith('A')
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith([mesa])
    })

    it('getById responde 200 con la mesa', async () => {
        const { service, controller, res, next } = setup()
        await controller.getById(req({ params: { restaurantId: 'A', id: 't1' } }), res, next)
        expect(service.findById).toHaveBeenCalledWith('A', 't1')
        expect(res.json).toHaveBeenCalledWith(mesa)
    })

    it('update pasa los campos editables y responde 200', async () => {
        const { service, controller, res, next } = setup()
        await controller.update(req({ params: { restaurantId: 'A', id: 't1' }, body: { number: 2, capacity: 6, restaurantId: 'X', occupiedBy: 'hack' } }), res, next)
        expect(service.update).toHaveBeenCalledWith('A', 't1', { number: 2, description: undefined, capacity: 6, status: undefined })
        expect(res.status).toHaveBeenCalledWith(200)
    })

    it('delete responde 204 sin cuerpo', async () => {
        const { service, controller, res, next } = setup()
        await controller.delete(req({ params: { restaurantId: 'A', id: 't1' } }), res, next)
        expect(service.delete).toHaveBeenCalledWith('A', 't1')
        expect(res.status).toHaveBeenCalledWith(204)
        expect(res.send).toHaveBeenCalled()
    })

    it('updateStatus pasa el estado del cuerpo y responde 200', async () => {
        const { service, controller, res, next } = setup()
        await controller.updateStatus(req({ params: { restaurantId: 'A', id: 't1' }, body: { status: 'libre' } }), res, next)
        expect(service.updateStatus).toHaveBeenCalledWith('A', 't1', 'libre')
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(mesa)
    })
})

describe('TableController (cliente)', () => {
    const { occupiedBy: _omitido, ...mesaPublica } = mesa

    it('getAvailable pasa la query people sin transformar y responde sin occupiedBy', async () => {
        const { service, controller, res, next } = setup()
        await controller.getAvailable(req({ params: { restaurantId: 'A' }, query: { people: '3' } }), res, next)
        expect(service.findAvailable).toHaveBeenCalledWith('A', '3')
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith([mesaPublica])
    })

    it('getMine usa el id del cliente autenticado', async () => {
        const { service, controller, res, next } = setup()
        await controller.getMine(req({ params: { restaurantId: 'A' }, user: { id: 'cliente-1', role: 'cliente', restaurantId: null } }), res, next)
        expect(service.findMine).toHaveBeenCalledWith('A', 'cliente-1')
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(mesaPublica)
    })

    it('occupy usa el id del cliente autenticado e ignora el cuerpo', async () => {
        const { service, controller, res, next } = setup()
        await controller.occupy(req({ params: { restaurantId: 'A', id: 't1' }, body: { clientId: 'otro' }, user: { id: 'cliente-1', role: 'cliente', restaurantId: null } }), res, next)
        expect(service.occupy).toHaveBeenCalledWith('A', 't1', 'cliente-1')
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(mesaPublica)
    })
})

describe('TableController (errores y cuerpos ausentes)', () => {
    it.each([
        ['create', 'create'],
        ['getAll', 'findByRestaurantId'],
        ['getById', 'findById'],
        ['update', 'update'],
        ['delete', 'delete'],
        ['updateStatus', 'updateStatus'],
        ['getAvailable', 'findAvailable'],
        ['getMine', 'findMine'],
        ['occupy', 'occupy']
    ] as const)('%s delega el error en next sin responder', async (metodo, metodoServicio) => {
        const { service, controller, res, next } = setup()
        const error = new Error('fallo')
        service[metodoServicio].mockRejectedValue(error)
        await controller[metodo](req({ params: { restaurantId: 'A', id: 't1' }, user: { id: 'c1', role: 'cliente', restaurantId: null } }), res, next)
        expect(next).toHaveBeenCalledWith(error)
        expect(res.status).not.toHaveBeenCalled()
    })

    it('create y updateStatus sin cuerpo llegan al servicio con campos undefined (que valida él)', async () => {
        const { service, controller, res, next } = setup()
        await controller.create(req({ params: { restaurantId: 'A' }, body: undefined }), res, next)
        await controller.updateStatus(req({ params: { restaurantId: 'A', id: 't1' }, body: undefined }), res, next)
        expect(service.create).toHaveBeenCalledWith({ number: undefined, description: undefined, capacity: undefined, status: undefined, restaurantId: 'A' })
        expect(service.updateStatus).toHaveBeenCalledWith('A', 't1', undefined)
        expect(next).not.toHaveBeenCalled()
    })

    it('la respuesta de staff solo incluye los campos del contrato', async () => {
        const { service, controller, res, next } = setup()
        service.findById.mockResolvedValue({ ...mesa, extra: 'no' })
        await controller.getById(req({ params: { restaurantId: 'A', id: 't1' } }), res, next)
        expect(res.json).toHaveBeenCalledWith(mesa)
    })
})
