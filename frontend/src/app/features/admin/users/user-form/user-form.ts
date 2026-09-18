import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './user-form.html',
  styleUrl: './user-form.css',
})
export class UserForm {
  private fb = inject(FormBuilder);

  userForm = this.fb.group({
    name: ['', Validators.required],
    username: ['', Validators.required],
    password: ['', Validators.required],
    role: ['VENDEDOR', Validators.required],
    area: [''],
    location: [''],
    description: ['']
  });

  onSubmit() {
    if (this.userForm.valid) {
      console.log('Form data:', this.userForm.value);
      // Aquí iría la llamada al Admin Service (Spring Boot)
    }
  }
}
