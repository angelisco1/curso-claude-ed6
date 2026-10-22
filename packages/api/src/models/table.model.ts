import { InvalidTableStatusError } from '@errors/DomainErrors.js'

export const VALID_TABLE_STATUSES = ['libre', 'ocupada', 'reservada'] as const

export type TableStatusType = typeof VALID_TABLE_STATUSES[number]

export interface Table {
    id: string
    number: number
    description: string | null
    capacity: number
    status: TableStatusType
    occupiedBy: string | null
    restaurantId: string
    createdAt: string
    updatedAt: string
}

export function normalizeTableStatus(value: string): TableStatusType {
    const normalized = typeof value === 'string' ? value.toLowerCase().trim() : ''
    if (!VALID_TABLE_STATUSES.includes(normalized as TableStatusType)) {
        throw new InvalidTableStatusError(`Estado inválido: ${value}. Debe ser uno de: ${VALID_TABLE_STATUSES.join(', ')}`)
    }
    return normalized as TableStatusType
}
