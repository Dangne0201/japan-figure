import cases from '../src/knowledge/evaluation-cases.json';

describe('chatbot evaluation dataset', () => {
  it('contains at least 40 unique cases across each required safety and quality category', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(cases.length);
    expect(new Set(cases.map(({ category }) => category))).toEqual(
      new Set(['normal', 'tricky', 'off_topic', 'injection', 'cross_user']),
    );
    for (const evaluationCase of cases) {
      expect(evaluationCase.question.length).toBeGreaterThan(0);
      expect(evaluationCase.question.length).toBeLessThanOrEqual(500);
      if (evaluationCase.expectedSource) {
        expect(evaluationCase.expectedSource).toMatch(/\.md$/u);
      }
    }
  });
});
