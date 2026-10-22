export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export const TABLE_STATUSES: TableStatus[] = ['libre', 'ocupada', 'reservada']

export interface Table {
  id: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  occupiedBy: string | null
  restaurantId: string
  createdAt: string
  updatedAt: string
}

export interface CreateTableDto {
  number: number
  description: string | null
  capacity: number
  status?: TableStatus
}

export interface UpdateTableDto {
  number: number
  description: string | null
  capacity: number
  status?: TableStatus
}
