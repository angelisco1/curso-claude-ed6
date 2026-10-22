import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { AuthController } from './AuthController.js'
import type { LoginUseCase } from '@employee/application/LoginUseCase.js'

describe('AuthController.register', () => {
    it('sin RegisterClientUseCase delega en next un error en español', async () => {
        const controller = new AuthController({} as LoginUseCase)
        const next = vi.fn()

        await controller.register({ body: {} } as Request, {} as Response, next)

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'RegisterClientUseCase no está configurado' }))
    })
})
