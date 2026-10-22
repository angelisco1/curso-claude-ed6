import { TestBed } from '@angular/core/testing'
import { importProvidersFrom, provideZonelessChangeDetection } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { provideRouter } from '@angular/router'
import { RouterTestingHarness } from '@angular/router/testing'
import { LucideAngularModule, Armchair, Edit, Plus, Trash2 } from 'lucide-angular'
import { TableListComponent } from './table-list.component'
import { TABLE_ROUTES } from '../../tables.routes'
import type { Table } from '../../models/table.model'

const BASE = '/api/v1/restaurants/r1/tables'

const makeTable = (id: string, number: number, overrides: Partial<Table> = {}): Table => ({
  id,
  number,
  description: null,
  capacity: 4,
  status: 'libre',
  occupiedBy: null,
  restaurantId: 'r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
})

describe('TableListComponent', () => {
  let harness: RouterTestingHarness
  let http: HttpTestingController
  let el: HTMLElement

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'restaurants/:restaurantId', children: [{ path: 'tables', children: TABLE_ROUTES }] }
        ]),
        importProvidersFrom(LucideAngularModule.pick({ Armchair, Edit, Plus, Trash2 }))
      ]
    })
    http = TestBed.inject(HttpTestingController)
    harness = await RouterTestingHarness.create()
    await harness.navigateByUrl('/restaurants/r1/tables', TableListComponent)
    el = harness.routeNativeElement!
  })

  // Si un test falla con peticiones abiertas, verify() lanza: se resetea TestBed
  // igualmente para que el fallo no arrastre a los tests siguientes.
  afterEach(() => {
    vi.restoreAllMocks()
    try {
      http.verify()
    } finally {
      TestBed.resetTestingModule()
    }
  })

  // El store actualiza sus signals tras el await de firstValueFrom: se deja correr
  // esa continuación antes de esperar a que el componente se estabilice.
  const settle = async () => {
    await new Promise(resolve => setTimeout(resolve))
    await harness.fixture.whenStable()
  }

  const loadTables = async (tables: Table[]) => {
    http.expectOne({ method: 'GET', url: BASE }).flush(tables)
    await settle()
  }

  const rows = () => Array.from(el.querySelectorAll('tbody tr'))
  const cells = (row: Element) => Array.from(row.querySelectorAll('td')).map(td => td.textContent!.trim())

  it('pide las mesas del restaurante de la ruta y muestra el spinner mientras cargan', () => {
    http.expectOne({ method: 'GET', url: BASE })
    expect(el.querySelector('.spinner')).not.toBeNull()
    http.match(BASE).forEach(req => req.flush([]))
  })

  it('pinta una fila por mesa con número, descripción, capacidad y estado', async () => {
    await loadTables([
      makeTable('t1', 1, { description: 'Ventana', capacity: 2 }),
      makeTable('t2', 5, { status: 'ocupada', capacity: 6 })
    ])

    expect(el.querySelector('.spinner')).toBeNull()
    expect(rows()).toHaveLength(2)
    expect(cells(rows()[0]!).slice(0, 4)).toEqual(['1', 'Ventana', '2', 'libre'])
    expect(cells(rows()[1]!).slice(0, 4)).toEqual(['5', '—', '6', 'ocupada'])
    expect(rows()[1]!.querySelector('span')!.className).toBe('badge badge-ocupada')
  })

  it('enlaza a crear y a editar cada mesa', async () => {
    await loadTables([makeTable('t1', 1)])

    const hrefs = Array.from(el.querySelectorAll('a')).map(a => a.getAttribute('href'))
    expect(hrefs).toContain('/restaurants/r1/tables/new')
    expect(hrefs).toContain('/restaurants/r1/tables/t1/edit')
  })

  it('muestra el estado vacío si no hay mesas', async () => {
    await loadTables([])

    expect(el.querySelector('table')).toBeNull()
    expect(el.querySelector('.empty-state')!.textContent).toContain('No hay mesas para este restaurante')
  })

  it('muestra el error del store si la carga falla', async () => {
    http.expectOne(BASE).flush({ error: 'Error' }, { status: 500, statusText: 'Server Error' })
    await settle()

    expect(el.querySelector('.alert-error')!.textContent).toContain('No se pudieron cargar las mesas.')
    expect(el.querySelector('table')).toBeNull()
  })

  it('elimina la mesa tras confirmar y la quita de la tabla', async () => {
    await loadTables([makeTable('t1', 1), makeTable('t2', 2)])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    rows()[0]!.querySelector<HTMLButtonElement>('button.btn-danger')!.click()
    expect(confirmSpy).toHaveBeenCalledWith('¿Estás seguro de eliminar la mesa 1?')
    http.expectOne({ method: 'DELETE', url: `${BASE}/t1` }).flush(null, { status: 204, statusText: 'No Content' })
    await settle()

    expect(rows()).toHaveLength(1)
    expect(cells(rows()[0]!)[0]).toBe('2')
  })

  it('no elimina nada si se cancela la confirmación', async () => {
    await loadTables([makeTable('t1', 1)])
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    rows()[0]!.querySelector<HTMLButtonElement>('button.btn-danger')!.click()
    await settle()

    http.expectNone({ method: 'DELETE' })
    expect(rows()).toHaveLength(1)
  })

  it('muestra el mensaje de la API si la eliminación falla', async () => {
    await loadTables([makeTable('t1', 1)])
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    rows()[0]!.querySelector<HTMLButtonElement>('button.btn-danger')!.click()
    http.expectOne({ method: 'DELETE', url: `${BASE}/t1` }).flush(
      { error: 'TableOccupiedError', message: 'No se puede eliminar una mesa ocupada' },
      { status: 409, statusText: 'Conflict' }
    )
    await settle()

    expect(el.querySelector('.alert-error')!.textContent).toContain('No se puede eliminar una mesa ocupada')
    expect(rows()).toHaveLength(1)
  })
})
