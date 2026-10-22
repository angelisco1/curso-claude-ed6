import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Table, TableStatus } from '../models/table.model';
import { TableService } from '../services/table.service';

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly tableService = inject(TableService);

  private readonly _tables = signal<Table[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  readonly tables = this._tables.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly tableNumberById = computed(() => {
    const map = new Map<string, number>();
    for (const table of this._tables()) {
      map.set(table.id, table.number);
    }
    return map;
  });

  async loadTables(restaurantId: string): Promise<void> {
    this._loading.set(true);
    try {
      const tables = await firstValueFrom(this.tableService.getAll(restaurantId));
      this._tables.set(tables);
      this._error.set(null);
    } catch (err: any) {
      this._error.set(this.errorMessage(err, 'Error al cargar las mesas'));
    } finally {
      this._loading.set(false);
    }
  }

  async updateStatus(restaurantId: string, id: string, status: TableStatus): Promise<void> {
    try {
      const updated = await firstValueFrom(this.tableService.updateStatus(restaurantId, id, { status }));
      this._tables.update(tables => tables.map(table => (table.id === id ? updated : table)));
      this._error.set(null);
    } catch (err: any) {
      this._error.set(this.errorMessage(err, 'Error al actualizar el estado de la mesa'));
    }
  }

  startPolling(restaurantId: string): void {
    this.stopPolling();
    this.loadTables(restaurantId);
    this.pollingInterval = setInterval(() => {
      this.loadTables(restaurantId);
    }, 30000);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Los errores de dominio traen `message`; los de los middlewares solo `error`.
  private errorMessage(err: any, fallback: string): string {
    return err?.error?.message ?? err?.error?.error ?? fallback;
  }
}
