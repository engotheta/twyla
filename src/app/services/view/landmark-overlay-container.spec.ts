import { OverlayContainer } from '@angular/cdk/overlay';
import { ANIMATION_MODULE_TYPE, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideI18n } from '@services/i18n/i18n-config.token';
import { I18nService } from '@services/i18n/i18n.service';
import { LandmarkOverlayContainer, provideOverlayLandmark } from './landmark-overlay-container';

@Component({ selector: 'probe', template: `<p class="probe">probe</p>` })
class ProbeComponent {}

describe('LandmarkOverlayContainer', () => {
  const NOOP_ANIMATIONS = { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' };

  it('leaves the plain CDK container alone without the provider', () => {
    TestBed.configureTestingModule({});
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    expect(container.getAttribute('role')).toBeNull();
  });

  it('makes the container a named landmark, wherever overlays ask for it', () => {
    TestBed.configureTestingModule({ providers: [provideOverlayLandmark(), NOOP_ANIMATIONS] });
    const container = TestBed.inject(OverlayContainer).getContainerElement();

    expect(TestBed.inject(OverlayContainer)).toBeInstanceOf(LandmarkOverlayContainer);
    expect(container.classList.contains('cdk-overlay-container')).toBe(true);
    expect(container.getAttribute('role')).toBe('region');
    expect(container.getAttribute('aria-label')).toBe('Pop-ups');

    // what Material opens lands inside it
    const ref = TestBed.inject(MatDialog).open(ProbeComponent);
    TestBed.tick();
    expect(container.querySelector('.probe')).toBeTruthy();
    ref.close();
  });

  it('is named in the language in use, and renamed when that changes', () => {
    TestBed.configureTestingModule({
      providers: [
        provideOverlayLandmark(),
        provideI18n({
          languages: [
            { code: 'en', name: 'English' },
            { code: 'sw', name: 'Kiswahili' },
          ],
        }),
      ],
    });
    const i18n = TestBed.inject(I18nService);
    i18n.use('sw');
    const container = TestBed.inject(LandmarkOverlayContainer).getContainerElement();
    expect(container.getAttribute('aria-label')).toBe('Madirisha ibukizi');

    i18n.use('en');
    TestBed.tick();
    expect(container.getAttribute('aria-label')).toBe('Pop-ups');
    document.documentElement.lang = 'en';
  });
});
