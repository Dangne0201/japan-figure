import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { hash } from 'bcryptjs';
import { AppModule } from '../app.module';
import { ChatService, type ChatCitation } from '../chat/chat.service';
import { PrismaService } from '../database/prisma.service';
import { normalizeForSearch } from './chunking';

interface AnswerEvaluationCase {
  id: string;
  question: string;
  expectedSource: string | null;
  requiredFactGroups: string[][];
  forbiddenFactGroups: string[][];
  mustRefuse?: boolean;
}

interface AnswerEvaluationResult {
  id: string;
  expectedSource: string | null;
  actualSources: string[];
  missingFactGroups: string[][];
  matchedForbiddenFactGroups: string[][];
  refusalSatisfied: boolean;
  passed: boolean;
}

export function scoreAnswer(
  evaluationCase: AnswerEvaluationCase,
  answer: string,
  citations: ChatCitation[],
): AnswerEvaluationResult {
  const normalizedAnswer = normalizeForSearch(answer);
  const actualSources = [...new Set(citations.map(({ path: sourcePath }) => sourcePath ?? ''))];
  const missingFactGroups = evaluationCase.requiredFactGroups.filter(
    (alternatives) =>
      !alternatives.some((fact) => normalizedAnswer.includes(normalizeForSearch(fact))),
  );
  const matchedForbiddenFactGroups = evaluationCase.forbiddenFactGroups.filter((alternatives) =>
    alternatives.some((fact) => normalizedAnswer.includes(normalizeForSearch(fact))),
  );
  const refusalSatisfied =
    !evaluationCase.mustRefuse ||
    (actualSources.length === 0 &&
      ['chua tim thay', 'khong co thong tin', 'khong the tra loi'].some((phrase) =>
        normalizedAnswer.includes(phrase),
      ));
  const sourceSatisfied = evaluationCase.expectedSource
    ? actualSources.some(
        (source) =>
          source === evaluationCase.expectedSource ||
          source.endsWith(`/${evaluationCase.expectedSource}`),
      )
    : actualSources.length === 0;

  return {
    id: evaluationCase.id,
    expectedSource: evaluationCase.expectedSource,
    actualSources,
    missingFactGroups,
    matchedForbiddenFactGroups,
    refusalSatisfied,
    passed:
      sourceSatisfied &&
      missingFactGroups.length === 0 &&
      matchedForbiddenFactGroups.length === 0 &&
      refusalSatisfied,
  };
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const chat = app.get(ChatService);
  const email = `answer-evaluation-${randomUUID()}@example.test`;
  let userId: string | undefined;

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Chatbot Answer Evaluation',
        passwordHash: await hash(randomUUID(), 4),
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    userId = user.id;
    const cases = await loadCases();
    const results: AnswerEvaluationResult[] = [];

    for (const evaluationCase of cases) {
      const conversation = await chat.createConversation(user.id);
      let answer = '';
      let citations: ChatCitation[] = [];
      await chat.streamMessage(
        user.id,
        conversation.id,
        evaluationCase.question,
        (sources) => {
          citations = sources;
        },
        (token) => {
          answer += token;
        },
      );
      const result = scoreAnswer(evaluationCase, answer, citations);
      results.push(result);
      console.info(JSON.stringify({ ...result, answer }));
    }

    const passed = results.filter(({ passed: didPass }) => didPass).length;
    console.info(
      JSON.stringify({
        metric: 'grounded_answer_fact_source_refusal_and_safety_checks',
        passed,
        total: results.length,
        pass_rate: Number((passed / results.length).toFixed(3)),
        limitation:
          'This rubric checks required/forbidden phrases and citations; it is not a semantic judge and does not replace human review.',
      }),
    );
    if (passed !== results.length) process.exitCode = 1;
  } finally {
    try {
      if (userId) {
        await prisma.chatConversation.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
      }
    } finally {
      await app.close();
    }
  }
}

async function loadCases(): Promise<AnswerEvaluationCase[]> {
  const candidates = [
    path.join(__dirname, 'answer-evaluation-cases.json'),
    path.join(process.cwd(), 'apps', 'api', 'src', 'knowledge', 'answer-evaluation-cases.json'),
    path.join(process.cwd(), 'src', 'knowledge', 'answer-evaluation-cases.json'),
  ];
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(await readFile(candidate, 'utf8'));
      if (!isAnswerEvaluationCases(parsed)) {
        throw new Error(`Answer evaluation cases in ${candidate} have an invalid shape.`);
      }
      if (!parsed.length || new Set(parsed.map(({ id }) => id)).size !== parsed.length) {
        throw new Error(`Answer evaluation cases in ${candidate} must have unique IDs.`);
      }
      return parsed;
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
  throw new Error('Could not locate the chatbot answer evaluation case dataset.');
}

function isAnswerEvaluationCases(value: unknown): value is AnswerEvaluationCase[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        'question' in item &&
        typeof item.question === 'string' &&
        item.question.length > 0 &&
        'expectedSource' in item &&
        (item.expectedSource === null || typeof item.expectedSource === 'string') &&
        'requiredFactGroups' in item &&
        isStringGroups(item.requiredFactGroups) &&
        'forbiddenFactGroups' in item &&
        isStringGroups(item.forbiddenFactGroups) &&
        (!('mustRefuse' in item) || typeof item.mustRefuse === 'boolean'),
    )
  );
}

function isStringGroups(value: unknown): value is string[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (group: unknown) =>
        Array.isArray(group) &&
        group.length > 0 &&
        group.every((phrase: unknown) => typeof phrase === 'string' && phrase.length > 0),
    )
  );
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.stack : 'Unknown chatbot answer evaluation failure.',
    );
    process.exitCode = 1;
  });
}
