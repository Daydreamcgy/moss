import { StateEffect, StateField } from '@codemirror/state';

export interface UiMode {
  source: boolean;
  focus: boolean;
  typewriter: boolean;
}

export const defaultUiMode: UiMode = { source: false, focus: false, typewriter: false };

export const setUiMode = StateEffect.define<Partial<UiMode>>();

export const uiModeField = StateField.define<UiMode>({
  create: () => ({ ...defaultUiMode }),
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(setUiMode)) next = { ...next, ...effect.value };
    }
    return next;
  },
});
