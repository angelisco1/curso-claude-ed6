import type { DishRepository } from '@repositories/dish.repository.js'
import type { Dish } from '@models/dish.model.js'

export class MockDishRepository implements DishRepository {
    private dishes: Map<string, Dish> = new Map()

    async findById(id: string): Promise<Dish | null> {
        return this.dishes.get(id) || null
    }

    async findByRestaurantId(restaurantId: string): Promise<Dish[]> {
        return Array.from(this.dishes.values())
            .filter(d => d.restaurantId === restaurantId)
    }

    async save(dish: Dish): Promise<void> {
        this.dishes.set(dish.id, dish)
    }

    async delete(id: string): Promise<void> {
        this.dishes.delete(id)
    }
}
