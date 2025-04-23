import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  scrollToSection(sectionId: string): void {
    const navBar = document.getElementById('navbar');
    const element = document.getElementById(sectionId);
    if (element) {
      const navBarHeight = navBar!.offsetHeight;
      const offsetPosition = element.getBoundingClientRect().top + window.scrollY - navBarHeight;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  }
}
