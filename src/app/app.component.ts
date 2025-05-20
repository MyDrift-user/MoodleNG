import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'MoodleNG';
  
  constructor(private themeService: ThemeService) {}
  
  ngOnInit() {
    // Force theme reapplication on initial load
    this.themeService.themeSettings$.subscribe(settings => {
      // This will re-trigger theme application
      this.themeService.updateTheme(settings);
    });
  }
}
