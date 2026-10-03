// details barrel — import everything from '.../details'

// ── types (config contract) ──
export * from './interfaces/details.interface';
export * from './interfaces/field.interface';
export * from './interfaces/field-group.interface';

// ── pure helpers ──
export * from './helpers/details.helpers';
export * from './helpers/fields.helpers';
export * from './helpers/field-group.helpers';
export * from './helpers/field-keys.helpers';
export * from './helpers/field-labels.helpers';
export * from './helpers/field-string.helpers';

// ── pipes + components ──
export * from './label.pipe';
export * from './bg-icon-mark.component';
export * from './details-header/details-header.component';
export * from './field-value/field-value.component';
export * from './field-group/field-group.component';
export * from './details.component';
