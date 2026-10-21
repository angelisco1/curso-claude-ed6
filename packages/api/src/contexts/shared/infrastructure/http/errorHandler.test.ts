import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { errorHandler } from './errorHandler.js'
import { OrderNotFoundError, InvalidOrderStatusError } from '@errors/DomainErrors.js'

function run(err: unknown) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    errorHandler(err, {} as Request, res, vi.fn())
    return res
}

describe('errorHandler', () => {
    it('responde 404 para OrderNotFoundError', () => {
        const res = run(new OrderNotFoundError())
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'OrderNotFoundError' }))
    })

    it('responde 400 para InvalidOrderStatusError', () => {
        const res = run(new InvalidOrderStatusError('Estado inválido'))
        expect(res.status).toHaveBeenCalledWith(400)
    })

    it('responde 500 genérico sin filtrar el mensaje para errores inesperados', () => {
        const res = run(new Error('detalle interno'))
        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith({ error: 'InternalServerError', message: 'Something went wrong' })
    })
})
