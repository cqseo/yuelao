import type { Band, TestDefinition } from './catalog';

export type Answer = 0 | 1 | 2;
export type QuizResult = { band: Band; concerns: number; answered: number };

// Editorial reflection bands, NOT probabilities, diagnosis, or psychometric scores.
// Each question has frequency answers: rarely (0), sometimes (1), often (2).
export function evaluateQuiz(test: TestDefinition, answers: Array<Answer | null>): QuizResult {
  if (answers.length !== test.questions.length ||
      answers.some((answer) => answer !== 0 && answer !== 1 && answer !== 2)) {
    throw new Error('Quiz requires every question to be answered');
  }
  const values = answers as Answer[];
  const score = values.reduce<number>((sum, answer) => sum + answer, 0);
  const fraction = score / (test.questions.length * 2);
  const band: Band = fraction < 0.3 ? 'low' : fraction < 0.68 ? 'review' : 'attention';
  return { band, concerns: values.filter((answer) => answer === 2).length, answered: values.length };
}
