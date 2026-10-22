import { describe, expect, it } from 'vitest'
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('seed', () => {
    it('aborta con un mensaje claro si NODE_ENV=production', () => {
        const resultado = spawnSync(process.execPath, ['--import', 'tsx', 'src/scripts/seed.ts'], {
            cwd: apiDir,
            env: { ...process.env, NODE_ENV: 'production' },
            encoding: 'utf-8',
            timeout: 30000
        })

        expect(resultado.status).toBe(1)
        expect(resultado.stderr).toContain('El seed no se puede ejecutar con NODE_ENV=production')
        expect(resultado.stdout).not.toContain('Database initialized')
    })
})
