import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface User {
  id: number;
  username: string;
  name: string;
  description?: string;
  area?: string;
  location?: string;
  role: 'ADMIN' | 'GERENCIA' | 'VENDEDOR';
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
})
export class UserList {
  users: User[] = [
    { id: 1, username: 'admin', name: 'Super Admin', role: 'ADMIN' },
    { id: 2, username: 'gerente.norte', name: 'Ana Gómez', area: 'Ventas Norte', location: 'Lima', role: 'GERENCIA' },
    { id: 3, username: 'vend.001', name: 'Carlos Ruiz', area: 'Ventas Norte', location: 'Trujillo', role: 'VENDEDOR' },
  ];
}
