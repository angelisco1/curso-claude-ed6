import { TestBed } from '@angular/core/testing'
import { provideZonelessChangeDetection } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { firstValueFrom } from 'rxjs'
import { TableService } from './table.service'
import type { CreateTableDto, Table, UpdateTableDto } from '../models/table.model'

const BASE = '/api/v1/restaurants/r1/tables'

const table: Table = {
  id: 't1',
  number: 1,
  description: 'Ventana',
  capacity: 4,
  status: 'libre',
  occupiedBy: null,
  restaurantId: 'r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('TableService', () => {
  let service: TableService
  let http: HttpTestingController

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    })
    service = TestBed.inject(TableService)
    http = TestBed.inject(HttpTestingController)
  })

  // Si un test falla con peticiones abiertas, verify() lanza: se resetea TestBed
  // igualmente para que el fallo no arrastre a los tests siguientes.
  afterEach(() => {
    try {
      http.verify()
    } finally {
      TestBed.resetTestingModule()
    }
  })

  it('getAll hace GET a las mesas del restaurante', async () => {
    const result = firstValueFrom(service.getAll('r1'))

    const req = http.expectOne(BASE)
    expect(req.request.method).toBe('GET')
    req.flush([table])

    expect(await result).toEqual([table])
  })

  it('getById hace GET a la mesa concreta', async () => {
    const result = firstValueFrom(service.getById('r1', 't1'))

    const req = http.expectOne(`${BASE}/t1`)
    expect(req.request.method).toBe('GET')
    req.flush(table)

    expect(await result).toEqual(table)
  })

  it('create hace POST con el DTO como cuerpo', async () => {
    const dto: CreateTableDto = { number: 2, description: null, capacity: 6, status: 'reservada' }
    const result = firstValueFrom(service.create('r1', dto))

    const req = http.expectOne(BASE)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toEqual(dto)
    req.flush({ ...table, ...dto, id: 't2' })

    expect((await result).id).toBe('t2')
  })

  it('update hace PUT a la mesa con el DTO como cuerpo', async () => {
    const dto: UpdateTableDto = { number: 3, description: 'Terraza', capacity: 2, status: 'ocupada' }
    const result = firstValueFrom(service.update('r1', 't1', dto))

    const req = http.expectOne(`${BASE}/t1`)
    expect(req.request.method).toBe('PUT')
    expect(req.request.body).toEqual(dto)
    req.flush({ ...table, ...dto })

    expect((await result).number).toBe(3)
  })

  it('delete hace DELETE a la mesa', async () => {
    const result = firstValueFrom(service.delete('r1', 't1'))

    const req = http.expectOne(`${BASE}/t1`)
    expect(req.request.method).toBe('DELETE')
    req.flush(null, { status: 204, statusText: 'No Content' })

    expect(await result).toBeNull()
  })
})
