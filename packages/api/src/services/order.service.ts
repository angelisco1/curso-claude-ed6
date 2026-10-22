import { randomUUID } from 'crypto'
import type { Order, OrderItem } from '@models/order.model.js'
import { normalizeOrderStatus } from '@models/order.model.js'
import type { OrderRepository } from '@repositories/order.repository.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    RestaurantIdRequiredError,
    OrderNotFoundError,
    TableNotFoundError,
    TableNotOccupiedError,
    TableNotAssignedError
} from '@errors/DomainErrors.js'

export interface CreateOrderRequest {
    restaurantId: string
    tableId: string | null
    clientId: string | null
    items: {
        dishId: string
        quantity: number
        notes: string | null
    }[]
}

export interface OrderRequester {
    id: string
    role: string
    restaurantId: string | null
}

export class OrderService {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly tableRepository: TableRepository
    ) {}

    async create(request: CreateOrderRequest, requester: OrderRequester): Promise<Order> {
        if (!request.restaurantId || request.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }
        if (request.tableId !== null) {
            await this.validateTable(request.restaurantId, request.tableId, requester)
        }

        const items: OrderItem[] = []
        for (const item of request.items) {
            for (let i = 0; i < item.quantity; i++) {
                items.push({
                    id: randomUUID(),
                    dishId: item.dishId,
                    quantity: 1,
                    notes: item.notes,
                    status: 'pendiente'
                })
            }
        }

        const order: Order = {
            id: randomUUID(),
            restaurantId: request.restaurantId,
            tableId: request.tableId,
            clientId: request.clientId,
            createdAt: new Date(),
            items
        }

        await this.orderRepository.create(order)

        return order
    }

    async listActive(restaurantId: string): Promise<Order[]> {
        return this.orderRepository.findActiveByRestaurant(restaurantId)
    }

    async getById(orderId: string, requester: OrderRequester): Promise<Order> {
        const order = await this.orderRepository.findById(orderId)
        if (!order || !this.canView(order, requester)) {
            throw new OrderNotFoundError()
        }
        return order
    }

    async getByClientId(clientId: string): Promise<Order[]> {
        return this.orderRepository.findByClientId(clientId)
    }

    async updateItemStatus(orderId: string, itemId: string, status: string, requester: OrderRequester): Promise<void> {
        const order = await this.orderRepository.findById(orderId)
        if (!order || requester.role === 'cliente' || !this.canView(order, requester)) {
            throw new OrderNotFoundError()
        }

        const item = order.items.find(i => i.id === itemId)
        if (!item) {
            throw new OrderNotFoundError() // Or ItemNotFoundError
        }

        const normalizedStatus = normalizeOrderStatus(status)
        item.status = normalizedStatus

        await this.orderRepository.updateItemStatus(orderId, itemId, normalizedStatus)
    }

    private async validateTable(restaurantId: string, tableId: string, requester: OrderRequester): Promise<void> {
        const table = await this.tableRepository.findById(tableId)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        if (table.status !== 'ocupada') {
            throw new TableNotOccupiedError()
        }
        if (requester.role === 'cliente' && table.occupiedBy !== requester.id) {
            throw new TableNotAssignedError()
        }
    }

    private canView(order: Order, requester: OrderRequester): boolean {
        if (requester.role === 'admin') return true
        if (requester.role === 'cliente') return order.clientId === requester.id
        return requester.restaurantId !== null && order.restaurantId === requester.restaurantId
    }
}
