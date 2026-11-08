import cases from '../src/knowledge/answer-evaluation-cases.json';
import { scoreAnswer } from '../src/knowledge/answer-evaluation';

describe('chatbot answer evaluation', () => {
  it('defines grounded-answer cases with required source and fact checks', () => {
    expect(cases).toHaveLength(5);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(cases.length);
    for (const evaluationCase of cases) {
      expect(evaluationCase.question.length).toBeGreaterThan(0);
      expect(evaluationCase.requiredFactGroups.length).toBeGreaterThan(0);
    }
  });

  it('scores required facts, citations, and prohibited claims', () => {
    const evaluationCase = getCase('figure10-discount');
    const result = scoreAnswer(
      evaluationCase,
      'FIGURE10 giảm 10% khi đơn đạt 500.000 ₫, giảm tối đa 200.000 ₫.',
      [
        {
          type: 'document',
          id: 'vouchers-loyalty',
          title: 'Ưu đãi',
          path: 'knowledge/vouchers-loyalty.md',
          chunkIndex: 0,
        },
      ],
    );

    expect(result.passed).toBe(true);
    expect(result.missingFactGroups).toEqual([]);
    expect(result.matchedForbiddenFactGroups).toEqual([]);
  });

  it('fails unsupported claims, missing sources, and unsafe non-refusals', () => {
    const evaluationCase = getCase('private-data-injection');
    const result = scoreAnswer(
      evaluationCase,
      'Email của khách hàng khác là customer@example.test.',
      [
        {
          type: 'document',
          id: 'account-and-chat-privacy',
          title: 'Quyền riêng tư',
          path: 'account-and-chat-privacy.md',
          chunkIndex: 0,
        },
      ],
    );

    expect(result.passed).toBe(false);
    expect(result.missingFactGroups).toHaveLength(2);
    expect(result.matchedForbiddenFactGroups).toHaveLength(1);
  });

  it('requires an uncited refusal for unsupported off-topic questions', () => {
    const evaluationCase = getCase('off-topic-refusal');
    const citation = {
      type: 'document' as const,
      id: 'shipping',
      title: 'Giao hàng',
      path: 'shipping.md',
      chunkIndex: 0,
    };

    expect(scoreAnswer(evaluationCase, 'Chưa tìm thấy thông tin phù hợp.', []).passed).toBe(true);
    expect(scoreAnswer(evaluationCase, 'Ngày mai trời nắng.', []).passed).toBe(false);
    expect(scoreAnswer(evaluationCase, 'Chưa tìm thấy thông tin.', [citation]).passed).toBe(false);
  });
});

function getCase(id: string) {
  const evaluationCase = cases.find((candidate) => candidate.id === id);
  if (!evaluationCase) throw new Error(`Answer evaluation case "${id}" is missing.`);
  return evaluationCase;
}
