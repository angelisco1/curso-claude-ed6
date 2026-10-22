export type TableStatus = 'libre' | 'ocupada' | 'reservada'

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

export interface UpdateTableStatusDto {
  status: TableStatus
}
