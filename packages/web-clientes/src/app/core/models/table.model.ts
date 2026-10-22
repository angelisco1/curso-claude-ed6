export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export interface Table {
  id: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  restaurantId: string
  createdAt: string
  updatedAt: string
}

export interface SelectedTable {
  id: string
  number: number
  restaurantId: string
}
