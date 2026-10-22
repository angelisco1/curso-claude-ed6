import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { OrderStore } from '../../../orders/store/order.store';
import { TableStore } from '../../store/table.store';
import { Order } from '../../../orders/models/order.model';
import { Table, TableStatus } from '../../models/table.model';

@Component({
  selector: 'app-mesas',
  standalone: true,
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);
  readonly orderStore = inject(OrderStore);

  readonly statuses: TableStatus[] = ['libre', 'ocupada', 'reservada'];

  private get restaurantId(): string | undefined {
    return this.authStore.user()?.restaurantId ?? undefined;
  }

  ngOnInit(): void {
    const restaurantId = this.restaurantId;
    if (restaurantId) {
      this.tableStore.startPolling(restaurantId);
      this.orderStore.startPolling(restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
    this.orderStore.stopPolling();
  }

  ordersOf(table: Table): Order[] {
    return this.orderStore.orders().filter(order => order.tableId === table.id);
  }

  changeStatus(table: Table, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as TableStatus;
    this.setStatus(table, status);
  }

  release(table: Table): void {
    this.setStatus(table, 'libre');
  }

  getStatusClass(status: string): string {
    return `badge badge-${status}`;
  }

  private setStatus(table: Table, status: TableStatus): void {
    const restaurantId = this.restaurantId;
    if (restaurantId) {
      this.tableStore.updateStatus(restaurantId, table.id, status);
    }
  }
}
