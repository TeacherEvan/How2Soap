import { describe, expect, it } from 'vitest';
import { buildJournalModel } from '../src/ui/JournalPanel';
import { initialProgression } from '../src/engine/progression';

describe('journal model', () => {
  it('derives locked/available/claimed letter states from save', () => {
    const save = initialProgression();
    save.chapter = 1;
    const model = buildJournalModel(save);
    expect(model.chapters).toHaveLength(6);
    expect(model.letters.find(l => l.id === 'l_jabir')!.state).toBe('available');
    expect(model.letters.find(l => l.id === 'l_davy')!.state).toBe('locked');
  });

  it('marks letters claimed when included in lettersDone', () => {
    const save = initialProgression();
    save.chapter = 1;
    save.lettersDone = ['l_jabir'];
    const model = buildJournalModel(save);
    expect(model.letters.find(l => l.id === 'l_jabir')!.state).toBe('claimed');
  });
});
