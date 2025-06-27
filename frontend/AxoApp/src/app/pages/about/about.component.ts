import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  imports: [RouterLink, CommonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css'
})
export class AboutComponent {
  navActive : boolean = false;
  scrollTo(fragment: string) {
    setTimeout(() => {
      const element = document.getElementById(fragment);
      if (element) {
        const yOffset = -72;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 0);
  }

  scrollTop() {
    setTimeout(() => {
      window.scrollTo({ top: 0 });
    }, 0);
  }

  menuToggle(){
    this.navActive = !this.navActive;
  }
}
