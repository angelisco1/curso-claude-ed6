import { randomUUID } from 'crypto'
import type { Table } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    RestaurantIdRequiredError,
    DuplicatedTableNumberError,
    TableNotFoundError,
    TableOccupiedError
} from '@errors/DomainErrors.js'

export interface CreateTableDTO {
    number: number
    description?: string | null
    capacity: number
    status?: string
    restaurantId: string
}

export interface UpdateTableDTO {
    number: number
    description?: string | null
    capacity: number
    status?: string
}

export class TableService {
    constructor(private readonly tableRepository: TableRepository) {}

    async create(dto: CreateTableDTO): Promise<Table> {
        const now = new Date().toISOString()
        const table = this.buildTable({
            id: randomUUID(),
            number: dto.number,
            description: dto.description ?? null,
            capacity: dto.capacity,
            status: dto.status ?? 'libre',
            occupiedBy: null,
            restaurantId: dto.restaurantId,
            createdAt: now,
            updatedAt: now
        })

        await this.ensureNumberIsFree(table)
        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.findById(restaurantId, id)

        const updated = this.buildTable({
            id: existing.id,
            number: dto.number,
            description: dto.description ?? null,
            capacity: dto.capacity,
            status: dto.status ?? existing.status,
            occupiedBy: existing.occupiedBy,
            restaurantId: existing.restaurantId,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        })
        if (updated.status !== existing.status) {
            updated.occupiedBy = null
        }

        await this.ensureNumberIsFree(updated)
        await this.tableRepository.save(updated)
        return updated
    }

    async updateStatus(restaurantId: string, id: string, status: string): Promise<Table> {
        const existing = await this.findById(restaurantId, id)
        const updated: Table = {
            ...existing,
            status: normalizeTableStatus(status),
            occupiedBy: null,
            updatedAt: new Date().toISOString()
        }
        await this.tableRepository.save(updated)
        return updated
    }

    async delete(restaurantId: string, id: string): Promise<void> {
        const table = await this.findById(restaurantId, id)
        if (table.status === 'ocupada') {
            throw new TableOccupiedError()
        }
        await this.tableRepository.delete(id)
    }

    async findById(restaurantId: string, id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return table
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        return this.tableRepository.findByRestaurantId(restaurantId)
    }

    private async ensureNumberIsFree(table: Table): Promise<void> {
        const existing = await this.tableRepository.findByNumber(table.restaurantId, table.number)
        if (existing && existing.id !== table.id) {
            throw new DuplicatedTableNumberError()
        }
    }

    private buildTable(props: {
        id: string
        number: number
        description: string | null
        capacity: number
        status: string
        occupiedBy: string | null
        restaurantId: string
        createdAt: string
        updatedAt: string
    }): Table {
        if (!isPositiveInteger(props.number)) {
            throw new InvalidTableNumberError()
        }
        if (!isPositiveInteger(props.capacity)) {
            throw new InvalidTableCapacityError()
        }
        const status = normalizeTableStatus(props.status)
        if (!props.restaurantId || props.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        return {
            id: props.id,
            number: props.number,
            description: normalizeDescription(props.description),
            capacity: props.capacity,
            status,
            occupiedBy: props.occupiedBy,
            restaurantId: props.restaurantId,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        }
    }
}

function isPositiveInteger(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function normalizeDescription(value: string | null): string | null {
    if (typeof value !== 'string' || value.trim() === '') return null
    return value.trim()
}
