import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { loadConfig } from '../config/env';
import { EmbeddingClient } from './embedding-client';
import { KnowledgeRetrievalService, type KnowledgeResult } from './knowledge-retrieval.service';

interface EvaluationCase {
  id: string;
  category: 'normal' | 'tricky' | 'off_topic' | 'injection' | 'cross_user';
  question: string;
  expectedSource: string | null;
}

interface EvaluationResult {
  id: string;
  category: EvaluationCase['category'];
  expectedSource: string | null;
  actualSources: string[];
  passed: boolean;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const cases = await loadCases();
    const retrieval = new KnowledgeRetrievalService(prisma, new EmbeddingClient(config), config);
    const results: EvaluationResult[] = [];

    for (const evaluationCase of cases) {
      const matches = await retrieval.search(evaluationCase.question);
      results.push(scoreCase(evaluationCase, matches));
    }

    for (const result of results) console.info(JSON.stringify(result));
    const categories = [...new Set(results.map(({ category }) => category))].sort();
    const byCategory = Object.fromEntries(
      categories.map((category) => {
        const categoryResults = results.filter((result) => result.category === category);
        const passed = categoryResults.filter(({ passed }) => passed).length;
        return [
          category,
          {
            passed,
            total: categoryResults.length,
            pass_rate: Number((passed / categoryResults.length).toFixed(3)),
          },
        ];
      }),
    );
    const passed = results.filter(({ passed: didPass }) => didPass).length;
    console.info(
      JSON.stringify({
        metric: 'retrieval_expected_source_or_safe_public_result',
        passed,
        total: results.length,
        pass_rate: Number((passed / results.length).toFixed(3)),
        by_category: byCategory,
        limitation:
          'This deterministic harness measures retrieval only; it does not automatically judge generated answer quality or resistance to prompt injection.',
      }),
    );
    if (passed !== results.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function loadCases(): Promise<EvaluationCase[]> {
  const candidates = [
    path.join(__dirname, 'evaluation-cases.json'),
    path.join(process.cwd(), 'apps', 'api', 'src', 'knowledge', 'evaluation-cases.json'),
    path.join(process.cwd(), 'src', 'knowledge', 'evaluation-cases.json'),
  ];
  let contents: string | undefined;
  for (const candidate of candidates) {
    try {
      contents = await readFile(candidate, 'utf8');
      break;
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
  if (!contents) throw new Error('Could not locate the chatbot evaluation case dataset.');
  const cases = JSON.parse(contents) as EvaluationCase[];
  if (cases.length < 40) throw new Error('The chatbot evaluation requires at least 40 cases.');
  const ids = new Set(cases.map(({ id }) => id));
  if (ids.size !== cases.length) throw new Error('Chatbot evaluation case IDs must be unique.');
  return cases;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function scoreCase(evaluationCase: EvaluationCase, matches: KnowledgeResult[]): EvaluationResult {
  const actualSources = [...new Set(matches.map(({ source }) => source.id))];
  const passed = evaluationCase.expectedSource
    ? actualSources.includes(evaluationCase.expectedSource)
    : evaluationCase.category === 'cross_user'
      ? matches.every(({ source }) => source.type === 'document' || source.type === 'product')
      : matches.length === 0;
  return {
    id: evaluationCase.id,
    category: evaluationCase.category,
    expectedSource: evaluationCase.expectedSource,
    actualSources,
    passed,
  };
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : 'Unknown chatbot evaluation failure.');
  process.exitCode = 1;
});
