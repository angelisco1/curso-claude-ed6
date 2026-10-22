import { describe, it, expect } from 'vitest'
import router from './order.routes.js'

// Verificación estructural: el comportamiento HTTP se prueba en order.routes.test.ts (T22).
function handlersCount(method: string, path: string): number {
    const layer = (router as any).stack.find((l: any) => l.route?.path === path && l.route.methods[method])
    return layer.route.stack.length
}

describe('order.routes (cadena de middlewares)', () => {
    it('POST /, GET /active y PATCH status llevan authenticate + authorize + controlador', () => {
        expect(handlersCount('post', '/')).toBe(3)
        expect(handlersCount('get', '/active')).toBe(3)
        expect(handlersCount('patch', '/:orderId/items/:itemId/status')).toBe(3)
    })

    it('GET /mine y GET /:id solo llevan authenticate + controlador', () => {
        expect(handlersCount('get', '/mine')).toBe(2)
        expect(handlersCount('get', '/:id')).toBe(2)
    })
})
