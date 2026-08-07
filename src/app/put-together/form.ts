import { Validators } from '@angular/forms';
import { FieldType, FormParameter, observe } from '../components/generic-form';
import { formResult } from './support/form-results';

// ─────────────────────────────────────────────
// "Conference Speaker & Session Proposal" — an end-to-end scenario built to exercise as much of
// generic-form's surface as one reasonably plausible form can: every field type and select/date
// variant, dynamic (observe) cascades, cross-validators (match/requiredIf/custom-async),
// steps + onProceed gating + the auto mixed step, isList object AND isList attachment fields,
// valueFn/toSubmit, readonly vs disabled vs hidden, autoLabels, and an inline button field.
// ─────────────────────────────────────────────

const SESSION_TYPES = [
  { label: 'Talk', value: 'talk' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Panel', value: 'panel' },
  { label: 'Lightning Talk', value: 'lightning' },
];

const TALK_TRACKS = [
  { label: 'Frontend', value: 'frontend' },
  { label: 'Backend', value: 'backend' },
  { label: 'DevOps', value: 'devops' },
  { label: 'AI / ML', value: 'ai-ml' },
  { label: 'Career & Culture', value: 'career' },
];

const WORKSHOP_TRACKS = [
  { label: 'Hands-on Lab', value: 'lab' },
  { label: 'Deep Dive', value: 'deep-dive' },
];

// enough entries to make the select's virtualScroll actually kick in
const ALL_TAGS = [
  'Angular',
  'React',
  'Vue',
  'Svelte',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'Deno',
  'Bun',
  'GraphQL',
  'REST',
  'WebSockets',
  'RxJS',
  'Signals',
  'State Management',
  'Testing',
  'E2E',
  'Accessibility',
  'Performance',
  'Web Vitals',
  'PWA',
  'Micro-frontends',
  'Design Systems',
  'CSS',
  'Tailwind',
  'Animation',
  'WebGL',
  'Three.js',
  'AI Tooling',
  'LLMs',
  'Prompt Engineering',
  'DevOps',
  'CI/CD',
  'Docker',
  'Kubernetes',
  'Serverless',
  'Edge Computing',
  'Security',
  'Auth',
  'Databases',
  'SQL',
  'NoSQL',
  'Career Growth',
  'Public Speaking',
  'Open Source',
  'Mentorship',
].map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));

const RESERVED_TITLES = new Set(['test', 'todo', 'untitled', 'my talk']);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function getFormParameter(): FormParameter<Record<string, unknown>> {
  return {
    title: 'Conference Speaker & Session Proposal',
    icon: 'campaign',
    fieldsContainerClass: 'grid grid-cols-1 sm:grid-cols-2 gap-x-4',
    fieldsClass: 'mb-3',
    linearSteppers: false,
    stepperOrientation: 'vertical',
    mixedStepLabel: 'Stay in touch',
    mixedStepPosition: 'last',
    submitButtonLabel: 'Submit Proposal',
    submitButtonIcon: 'send',

    fields: [
      // ── Step 1: Speaker Details ──────────────────────────────
      {
        type: FieldType.step,
        label: 'Speaker Details',
        fields: [
          {
            type: FieldType.content,
            contentParameter: {
              content:
                '<em>Tell us who you are.</em> Fields marked required must be filled in before you can continue.',
            },
            value:
              '<em>Tell us who you are.</em> Fields marked required must be filled in before you can continue.',
          },
          {
            type: FieldType.input,
            key: 'fullName',
            label: 'Full name',
            autocomplete: 'name',
            valueFn: (value: string | number) => {
              if (typeof value === 'string') {
                return titleCase(value);
              }
              return value;
            },
            validations: [
              {
                name: 'required',
                validator: Validators.required,
                message: 'Your name is required',
              },
            ],
          },
          {
            type: FieldType.input,
            key: 'email',
            label: 'Email',
            inputType: 'email',
            updateOn: 'blur',
            validations: [
              { name: 'required', validator: Validators.required, message: 'Email is required' },
              { name: 'email', validator: Validators.email, message: 'Enter a valid email' },
            ],
          },
          {
            type: FieldType.input,
            key: 'confirmEmail',
            label: 'Confirm email',
            inputType: 'email',
            updateOn: 'blur',
            visible: observe('email', (email) => !!email),

            hint: 'Must match the email above — checked via a cross-validator (SPEC §9)',
          },
          {
            type: FieldType.input,
            key: 'phone',
            label: 'Phone',
            showClear: true,
          },

          // no `label` on purpose — demonstrates autoLabels deriving "Website" from the key
          { type: FieldType.input, key: 'website', inputType: 'url', placeholder: 'https://…' },
          {
            type: FieldType.attachment,
            key: 'avatar',
            label: 'Headshot',
            accept: ['image/*'],
            maxSizeMb: 5,
            hint: 'PNG or JPG, up to 5MB',
          },
          {
            type: FieldType.richText,
            key: 'bio',
            label: 'Speaker bio',
            value: observe(
              ['fullName', 'phone', 'email'],
              (fullName, phone, email) =>
                `Hi, I'm ${fullName ?? '…'}. You can reach me at ${phone ?? '…'} or ${email ?? '…'}. I like to talk about…`,
            ),
          },
        ],
      },

      // ── Step 2: Session Info ─────────────────────────────────
      {
        type: FieldType.step,
        label: 'Session Info',
        onProceed: (value) => {
          if (!value['sessionType']) {
            window.alert('Pick a session type before continuing.');
            return false;
          }
          return true;
        },
        fields: [
          {
            type: FieldType.input,
            key: 'sessionTitle',
            label: 'Session title',
            debounce: 400,
            validations: [
              {
                name: 'required',
                validator: Validators.required,
                message: 'Give your session a title',
              },
            ],
            // auto-capitalizes as the speaker types (SPEC §8 — valueFn runs on the way in)
            valueFn: (value: string | number) =>
              typeof value === 'string' ? titleCase(value) : value,
          },
          {
            type: FieldType.select,
            key: 'sessionType',
            label: 'Session type',
            searchable: true,
            options: SESSION_TYPES,
            validations: [
              { name: 'required', validator: Validators.required, message: 'Required' },
            ],
          },
          {
            type: FieldType.select,
            key: 'track',
            label: 'Track',
            // cascades off sessionType (SPEC §1 Dynamic observer)
            options: observe('sessionType', (sessionType: string) =>
              sessionType === 'workshop' ? WORKSHOP_TRACKS : TALK_TRACKS,
            ),
            visible: observe('sessionType', (sessionType: string) => !!sessionType),
          },
          {
            type: FieldType.select,
            key: 'duration',
            label: 'Duration (minutes)',
            variant: 'button',
            defaultValue: '30',
            options: [
              { label: '15', value: '15' },
              { label: '30', value: '30' },
              { label: '45', value: '45' },
              { label: '60', value: '60' },
            ],
          },
          {
            type: FieldType.select,
            key: 'levels',
            label: 'Audience level',
            variant: 'checkbox',
            multiple: true,
            options: [
              { label: 'Beginner', value: 'beginner' },
              { label: 'Intermediate', value: 'intermediate' },
              { label: 'Advanced', value: 'advanced' },
            ],
          },
          {
            type: FieldType.select,
            key: 'tags',
            label: 'Topic tags',
            searchable: true,
            virtualScroll: true,
            multiple: true,
            options: ALL_TAGS,
            hint: `${ALL_TAGS.length} options — search + virtual scroll`,
          },
          { type: FieldType.date, key: 'sessionDate', label: 'Preferred date', dateType: 'date' },
          {
            type: FieldType.date,
            key: 'checkInTime',
            label: 'Venue check-in time',
            dateType: 'time',
          },
          {
            type: FieldType.date,
            key: 'sessionDateTime',
            label: 'Exact session start',
            dateType: 'dateTime',
            toSubmit: (value: Date | string) =>
              value instanceof Date ? value.toISOString() : value,
          },
          {
            type: FieldType.object,
            key: 'coSpeakers',
            label: 'Co-speakers',
            isList: true,
            minItems: 0,
            maxItems: 3,
            itemLabelKey: 'name',
            hint: 'Up to 3 co-speakers',
            fields: [
              {
                type: FieldType.input,
                key: 'name',
                label: 'Name',
                validations: [
                  { name: 'required', validator: Validators.required, message: 'Required' },
                ],
              },
              { type: FieldType.input, key: 'email', label: 'Email', inputType: 'email' },
              {
                type: FieldType.select,
                key: 'role',
                label: 'Role',
                options: [
                  { label: 'Presenter', value: 'presenter' },
                  { label: 'Panelist', value: 'panelist' },
                  { label: 'Moderator', value: 'moderator' },
                ],
              },
            ],
          },
          {
            type: FieldType.attachment,
            key: 'slides',
            label: 'Slides / supporting docs',
            isList: true,
            maxItems: 5,
            accept: ['.pdf', '.key', '.pptx'],
            maxSizeMb: 20,
          },
        ],
      },

      // ── Step 3: Logistics & Preferences ──────────────────────
      {
        type: FieldType.step,
        label: 'Logistics & Preferences',
        fields: [
          {
            type: FieldType.select,
            key: 'attendanceMode',
            label: 'Attendance',
            variant: 'radio',
            defaultValue: 'in-person',
            options: [
              { label: 'In person', value: 'in-person' },
              { label: 'Remote', value: 'remote' },
            ],
          },
          {
            type: FieldType.checkbox,
            key: 'needsProjector',
            label: 'I need a projector / screen share',
          },
          {
            type: FieldType.checkbox,
            key: 'hasDietaryRestrictions',
            label: 'I have dietary restrictions',
          },
          {
            type: FieldType.textarea,
            key: 'dietaryDetails',
            label: 'Dietary details',
            rows: 2,
            // shown only when the checkbox above is ticked, and required in that case
            // (cross-validator `requiredIf`, SPEC §9) — both driven by the same trigger field
            visible: observe('hasDietaryRestrictions', (v: boolean) => !!v),
          },
          {
            type: FieldType.date,
            key: 'availableFrom',
            label: 'Available from',
            dateType: 'monthYear',
          },
          {
            type: FieldType.date,
            key: 'firstConferenceYear',
            label: 'Year of your first conference talk',
            dateType: 'year',
          },
          {
            type: FieldType.color,
            key: 'brandColor',
            label: 'Brand / theme color',
            colorFormat: 'hex',
            defaultValue: '#4f46e5',
          },
          {
            type: FieldType.textarea,
            key: 'specialRequests',
            label: 'Anything else the organizers should know?',
            rows: 3,
          },

          // readonly: visible + enabled-looking but not user-editable; still in the form value
          {
            type: FieldType.input,
            key: 'submittedBy',
            label: 'Submitted by',
            readonly: true,
            value: 'demo-organizer@conf.dev',
          },
          // disabled: included in the submit payload by default (same as hidden — see SPEC §6/§7)
          {
            type: FieldType.input,
            key: 'applicationId',
            label: 'Application ID',
            disabled: true,
            value: `SPK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          },
          // hidden: also included by default; flip `excludeHiddenOnSubmit: true` to drop it
          {
            type: FieldType.input,
            key: 'internalReviewNote',
            visible: false,
            value: 'Auto-flagged: first-time speaker',
          },

          {
            type: FieldType.checkbox,
            key: 'agreeToTerms',
            label: 'I agree to the speaker code of conduct',
            validations: [
              {
                name: 'required',
                validator: Validators.requiredTrue,
                message: 'You must accept to continue',
              },
            ],
          },
          { type: FieldType.label, value: 'We typically respond within 5 business days.' },
          {
            type: FieldType.button,
            label: 'Preview JSON',
            icon: 'visibility',
            click: (formValue) => formResult.set({ mode: 'preview', value: formValue ?? {} }),
          },
        ],
      },

      // ── outside any step — auto-collected into the "Stay in touch" mixed step (SPEC §5) ──
      {
        type: FieldType.toggle,
        key: 'newsletterOptIn',
        label: 'Send me updates about future conferences',
      },
    ],

    crossValidators: [
      {
        type: 'match',
        fields: ['email', 'confirmEmail'],
        showOn: 'confirmEmail',
        message: 'Emails must match',
      },
      {
        type: 'requiredIf',
        field: 'dietaryDetails',
        when: 'hasDietaryRestrictions',
        showOn: 'dietaryDetails',
        message: 'Please describe your dietary restrictions',
      },
      {
        type: 'custom',
        fields: ['sessionTitle'],
        showOn: 'sessionTitle',
        message: 'That title is already taken — try something more specific',
        validate: async (values) => {
          const title = String(values['sessionTitle'] ?? '')
            .trim()
            .toLowerCase();
          if (!title) return true;
          await delay(300); // simulated lookup
          return !RESERVED_TITLES.has(title);
        },
      },
    ],

    onSubmit: (value) => formResult.set({ mode: 'submitted', value }),
  };
}
