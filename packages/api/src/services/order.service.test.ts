import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService, type OrderRequester } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import type { Order } from '@models/order.model.js'
import { OrderNotFoundError, InvalidOrderStatusError } from '@errors/DomainErrors.js'

describe('OrderService.updateItemStatus', () => {
    let repo: MockOrderRepository
    let service: OrderService
    let testOrder: Order

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)

        testOrder = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: null,
            createdAt: new Date(),
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }
            ]
        }
        await repo.create(testOrder)
    })

    it('should update the status of an item successfully', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'preparando')
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status'))
            .rejects.toThrow(InvalidOrderStatusError)
    })
})

describe('OrderService.getById (control de acceso)', () => {
    let service: OrderService

    const admin: OrderRequester = { id: 'u-admin', role: 'admin', restaurantId: null }
    const camareroA: OrderRequester = { id: 'u-cam', role: 'camarero', restaurantId: 'rest-1' }
    const camareroB: OrderRequester = { id: 'u-camB', role: 'camarero', restaurantId: 'rest-2' }
    const clienteDueno: OrderRequester = { id: 'cli-1', role: 'cliente', restaurantId: null }
    const clienteAjeno: OrderRequester = { id: 'cli-2', role: 'cliente', restaurantId: null }

    beforeEach(async () => {
        const repo = new MockOrderRepository()
        service = new OrderService(repo)
        await repo.create({
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: 'cli-1',
            createdAt: new Date(),
            items: []
        })
    })

    it('el admin accede a cualquier pedido', async () => {
        expect((await service.getById('order-1', admin)).id).toBe('order-1')
    })

    it('un empleado accede a pedidos de su restaurante', async () => {
        expect((await service.getById('order-1', camareroA)).id).toBe('order-1')
    })

    it('un empleado de otro restaurante recibe OrderNotFoundError', async () => {
        await expect(service.getById('order-1', camareroB)).rejects.toThrow(OrderNotFoundError)
    })

    it('un cliente accede a su propio pedido', async () => {
        expect((await service.getById('order-1', clienteDueno)).id).toBe('order-1')
    })

    it('un cliente recibe OrderNotFoundError en un pedido ajeno', async () => {
        await expect(service.getById('order-1', clienteAjeno)).rejects.toThrow(OrderNotFoundError)
    })

    it('lanza OrderNotFoundError si el pedido no existe', async () => {
        await expect(service.getById('no-existe', admin)).rejects.toThrow(OrderNotFoundError)
    })
})
