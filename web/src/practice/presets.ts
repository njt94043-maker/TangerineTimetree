// Practice-mixer presets, grades, and member defaults — S190 Slice 2.
// Lifted verbatim from the locked mockup
// (Dev Team/mockups/tgt-web--band-practice-stem-mixer.html) so the UI
// matches the signed-off design. Multitrack stems exist in the data
// structure but ship disabled in Slice 2 (Demucs-only end-to-end per S190
// brief D-stem-2). When multitrack lands the grade selector turns on.

export type Grade = 'multitrack' | 'demucs';
export type MemberId = 'james' | 'adam' | 'neil';

export interface StemDef {
  id: string;
  name: string;
  accent: string;
  bv?: boolean;
}

export interface GradeDef {
  label: string;
  stems: StemDef[];
}

export const GRADES: Record<Grade, GradeDef> = {
  multitrack: {
    label: 'multitrack (our gig)',
    stems: [
      { id: 'drums',  name: 'Drums',    accent: '#ff5252' },
      { id: 'bass',   name: 'Bass',     accent: '#5B8DEF' },
      { id: 'guitar', name: 'Guitar',   accent: '#00e676' },
      { id: 'lead',   name: 'Lead Vox', accent: '#f39c12' },
      { id: 'bv',     name: 'BV',       accent: '#bb86fc', bv: true },
      { id: 'other',  name: 'Other',    accent: '#1abc9c' },
    ],
  },
  demucs: {
    label: 'Demucs (original)',
    stems: [
      { id: 'vocals', name: 'Vocals', accent: '#f39c12' },
      { id: 'drums',  name: 'Drums',  accent: '#ff5252' },
      { id: 'bass',   name: 'Bass',   accent: '#5B8DEF' },
      { id: 'other',  name: 'Other',  accent: '#1abc9c' },
    ],
  },
};

export interface Preset {
  id: string;
  label: string;
  mute?: string[];
  solo?: string[];
  bvOnly?: boolean;   // requires multitrack (separate BV channel)
  custom?: boolean;
}

export const PRESETS: Record<Grade, Preset[]> = {
  multitrack: [
    { id: 'full',     label: 'Full mix',            mute: [] },
    { id: 'bass',     label: 'Jam bass',            mute: ['bass'] },
    { id: 'guitar',   label: 'Jam guitar',          mute: ['guitar'] },
    { id: 'lead',     label: 'Sing lead',           mute: ['lead'] },
    { id: 'harmony',  label: 'Harmonise (mute BV)', mute: ['bv'], bvOnly: true },
    { id: 'voxsolo',  label: 'Solo vox (lead+BV)',  solo: ['lead', 'bv'], bvOnly: true },
    { id: 'leadless', label: 'Lead-removed',        mute: ['lead'] },
    { id: 'custom',   label: 'Custom',              custom: true },
  ],
  demucs: [
    { id: 'full',     label: 'Full mix',     mute: [] },
    { id: 'bass',     label: 'Jam bass',     mute: ['bass'] },
    { id: 'lead',     label: 'Sing lead',    mute: ['vocals'] },
    { id: 'voxsolo',  label: 'Solo vocals',  solo: ['vocals'] },
    { id: 'leadless', label: 'Lead-removed', mute: ['vocals'] },
    { id: 'custom',   label: 'Custom',       custom: true },
  ],
};

// Member → default preset for their instrument. James sings lead, Adam plays
// guitar (with BV), Neil plays bass. Demucs has no per-instrument 'guitar'
// preset, so Adam falls back to Full mix on the Demucs grade.
export const MEMBER_DEFAULT: Record<MemberId, string> = {
  james: 'lead',
  adam:  'guitar',
  neil:  'bass',
};

export const MEMBER_DEFAULT_DEMUCS: Record<MemberId, string> = {
  james: 'lead',
  adam:  'full',
  neil:  'bass',
};

export function defaultPresetIdFor(member: MemberId, grade: Grade): string {
  const map = grade === 'demucs' ? MEMBER_DEFAULT_DEMUCS : MEMBER_DEFAULT;
  return map[member];
}

export function findPreset(grade: Grade, presetId: string): Preset | undefined {
  return PRESETS[grade].find(p => p.id === presetId);
}

export interface MixState {
  mute: Record<string, boolean>;
  solo: Record<string, boolean>;
  level: Record<string, number>;
}

export function emptyMixState(): MixState {
  return { mute: {}, solo: {}, level: {} };
}

/**
 * Apply a preset on top of an existing MixState. Returns a NEW state object
 * (immutable update). `level` is preserved — presets only set mute + solo.
 * Custom presets leave mute + solo untouched (whatever the user set).
 */
export function applyPreset(state: MixState, preset: Preset): MixState {
  if (preset.custom) return state;
  const mute: Record<string, boolean> = {};
  const solo: Record<string, boolean> = {};
  (preset.mute ?? []).forEach(id => { mute[id] = true; });
  (preset.solo ?? []).forEach(id => { solo[id] = true; });
  return { mute, solo, level: state.level };
}

/**
 * Compute the effective playing state for each stem given the mix.
 * "Solo wins" — if anything is soloed, only soloed stems sound.
 */
export function effectiveMuted(stemId: string, state: MixState): boolean {
  const anySolo = Object.values(state.solo).some(Boolean);
  if (anySolo) return !state.solo[stemId];
  return !!state.mute[stemId];
}
