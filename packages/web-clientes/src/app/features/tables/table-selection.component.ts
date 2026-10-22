import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { HttpErrorResponse } from '@angular/common/http'
import { CartStore } from '../../core/store/cart.store'
import { TableService } from '../../core/services/table.service'
import { Table } from '../../core/models/table.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>Elige tu mesa</h1>
          <p>Indica cuántos sois y selecciona una mesa libre</p>
        </div>
      </div>

      @if (checking()) {
        <div class="spinner"></div>
      } @else {
        <div class="card search-card">
          <div class="form-group">
            <label for="people">Número de comensales</label>
            <input id="people" class="form-control" type="number" min="1" step="1"
                   [value]="people()" (input)="onPeopleInput($event)" />
          </div>
          <button class="btn btn-primary" [disabled]="searching()" (click)="search()">
            {{ searching() ? 'Buscando...' : 'Buscar mesas' }}
          </button>
        </div>

        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
        }

        @if (searched()) {
          @if (tables().length === 0) {
            <div class="empty-state card">
              <p>No hay mesas libres para {{ people() }} comensales</p>
            </div>
          } @else {
            <div class="tables-grid">
              @for (table of tables(); track table.id) {
                <button type="button" class="table-card card"
                        [class.selected]="selected()?.id === table.id"
                        (click)="select(table)">
                  <strong>Mesa {{ table.number }}</strong>
                  <span>Capacidad: {{ table.capacity }}</span>
                  @if (table.description) {
                    <span class="description">{{ table.description }}</span>
                  }
                </button>
              }
            </div>
            <button class="btn btn-primary continue-btn" [disabled]="!selected() || occupying()"
                    (click)="continue()">
              {{ occupying() ? 'Reservando mesa...' : 'Continuar' }}
            </button>
          }
        }
      }
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .back-link {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: inline-block;
    }
    .search-card {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .search-card .form-group {
      flex: 1;
      margin-bottom: 0;
    }
    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }
    .continue-btn {
      margin-top: 20px;
    }
    .table-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 16px;
      text-align: left;
      cursor: pointer;
      color: var(--text-primary);
      transition: all var(--transition);
    }
    .table-card:hover,
    .table-card.selected {
      border-color: var(--green-medium);
    }
    .table-card.selected {
      background: var(--green-glow);
    }
    .table-card span {
      color: var(--text-secondary);
      font-size: 13px;
    }
    .table-card .description {
      color: var(--text-muted);
    }
  `]
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly tableService = inject(TableService)
  private readonly cartStore = inject(CartStore)

  private restaurantId = ''

  readonly checking = signal(true)
  readonly searching = signal(false)
  readonly occupying = signal(false)
  readonly searched = signal(false)
  readonly people = signal(2)
  readonly tables = signal<Table[]>([])
  readonly selected = signal<Table | null>(null)
  readonly error = signal<string | null>(null)

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!
    // Mensaje enviado por otra pantalla (p. ej. el carrito cuando la mesa deja de ser válida)
    this.error.set(history.state?.message ?? null)
    this.checkMyTable()
  }

  onPeopleInput(event: Event): void {
    this.people.set(Number((event.target as HTMLInputElement).value))
  }

  search(): void {
    const people = this.people()
    if (!Number.isInteger(people) || people < 1) {
      this.error.set('El número de comensales debe ser un entero mayor que 0')
      return
    }

    this.searching.set(true)
    this.error.set(null)
    this.selected.set(null)

    this.tableService.getAvailable(this.restaurantId, people).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        this.searched.set(true)
        this.searching.set(false)
      },
      error: (err) => {
        this.error.set(this.getErrorMessage(err, 'Error al cargar las mesas disponibles'))
        this.searching.set(false)
      }
    })
  }

  select(table: Table): void {
    this.selected.set(table)
  }

  continue(): void {
    const table = this.selected()
    if (!table) return

    this.occupying.set(true)
    this.error.set(null)

    this.tableService.occupy(this.restaurantId, table.id).subscribe({
      next: (occupied) => {
        this.cartStore.setTable({ id: occupied.id, number: occupied.number, restaurantId: occupied.restaurantId })
        this.router.navigate(['/restaurants', this.restaurantId])
      },
      error: (err: HttpErrorResponse) => {
        const message = this.getErrorMessage(err, 'No se ha podido ocupar la mesa')
        this.occupying.set(false)
        if (err.error?.error === 'TableNotAvailableError') {
          // La mesa se ha ocupado entre tanto: se recarga la lista de libres
          this.search()
        }
        this.error.set(message)
      }
    })
  }

  private checkMyTable(): void {
    this.tableService.getMine(this.restaurantId).subscribe({
      next: (table) => {
        this.cartStore.setTable({ id: table.id, number: table.number, restaurantId: table.restaurantId })
        this.router.navigate(['/restaurants', this.restaurantId], { replaceUrl: true })
      },
      error: (err: HttpErrorResponse) => {
        // 404: el cliente aún no ocupa ninguna mesa en este restaurante
        if (err.status !== 404) {
          this.error.set(this.getErrorMessage(err, 'Error al comprobar tu mesa'))
        }
        this.checking.set(false)
      }
    })
  }

  protected getErrorMessage(err: HttpErrorResponse, fallback: string): string {
    return err.error?.message ?? err.error?.error ?? fallback
  }
}
