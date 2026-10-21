import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { OrderController } from './order.controller.js'
import type { OrderService } from '@services/order.service.js'
import { OrderNotFoundError } from '@errors/DomainErrors.js'

function setup() {
    const service = {
        listActive: vi.fn().mockResolvedValue([]),
        getById: vi.fn().mockResolvedValue({ id: 'o1' }),
        updateItemStatus: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue({ id: 'o1' })
    }
    const controller = new OrderController(service as unknown as OrderService)
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() } as unknown as Response
    const next = vi.fn()
    return { service, controller, res, next }
}

const req = (extra: object) => extra as unknown as Request

describe('OrderController.getActiveOrders', () => {
    it('un empleado usa el restaurantId de su token e ignora el de la query', async () => {
        const { service, controller, res, next } = setup()
        await controller.getActiveOrders(
            req({ user: { id: 'u1', role: 'cocinero', restaurantId: 'A' }, query: { restaurantId: 'B' } }), res, next)
        expect(service.listActive).toHaveBeenCalledWith('A')
    })

    it('el admin usa el restaurantId de la query', async () => {
        const { service, controller, res, next } = setup()
        await controller.getActiveOrders(
            req({ user: { id: 'u1', role: 'admin', restaurantId: null }, query: { restaurantId: 'B' } }), res, next)
        expect(service.listActive).toHaveBeenCalledWith('B')
    })

    it('el admin sin restaurantId en la query recibe 400', async () => {
        const { service, controller, res, next } = setup()
        await controller.getActiveOrders(
            req({ user: { id: 'u1', role: 'admin', restaurantId: null }, query: {} }), res, next)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(service.listActive).not.toHaveBeenCalled()
    })
})

describe('OrderController (requester y errores)', () => {
    const user = { id: 'u1', role: 'camarero', restaurantId: 'A' }

    it('getById pasa el requester construido desde req.user', async () => {
        const { service, controller, res, next } = setup()
        await controller.getById(req({ user, params: { id: 'o1' } }), res, next)
        expect(service.getById).toHaveBeenCalledWith('o1', { id: 'u1', role: 'camarero', restaurantId: 'A' })
        expect(res.status).toHaveBeenCalledWith(200)
    })

    it('getById delega el error en next sin responder él mismo', async () => {
        const { service, controller, res, next } = setup()
        const error = new OrderNotFoundError()
        service.getById.mockRejectedValue(error)
        await controller.getById(req({ user, params: { id: 'o1' } }), res, next)
        expect(next).toHaveBeenCalledWith(error)
        expect(res.status).not.toHaveBeenCalled()
    })

    it('updateItemStatus pasa el requester y responde 204', async () => {
        const { service, controller, res, next } = setup()
        await controller.updateItemStatus(
            req({ user, params: { orderId: 'o1', itemId: 'i1' }, body: { status: 'listo' } }), res, next)
        expect(service.updateItemStatus).toHaveBeenCalledWith(
            'o1', 'i1', 'listo', { id: 'u1', role: 'camarero', restaurantId: 'A' })
        expect(res.status).toHaveBeenCalledWith(204)
    })

    it('updateItemStatus delega el error en next', async () => {
        const { service, controller, res, next } = setup()
        const error = new Error('detalle interno')
        service.updateItemStatus.mockRejectedValue(error)
        await controller.updateItemStatus(
            req({ user, params: { orderId: 'o1', itemId: 'i1' }, body: { status: 'listo' } }), res, next)
        expect(next).toHaveBeenCalledWith(error)
        expect(res.json).not.toHaveBeenCalled()
    })

    it('createOrder no filtra error.message: delega en next', async () => {
        const { service, controller, res, next } = setup()
        const error = new Error('detalle interno')
        service.create.mockRejectedValue(error)
        await controller.createOrder(req({ user, body: { restaurantId: 'A', items: [] } }), res, next)
        expect(next).toHaveBeenCalledWith(error)
        expect(res.json).not.toHaveBeenCalled()
    })

    it('getActiveOrders delega el error en next', async () => {
        const { service, controller, res, next } = setup()
        const error = new Error('x')
        service.listActive.mockRejectedValue(error)
        await controller.getActiveOrders(req({ user, query: {} }), res, next)
        expect(next).toHaveBeenCalledWith(error)
    })
})
