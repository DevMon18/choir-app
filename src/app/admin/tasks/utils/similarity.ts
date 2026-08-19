import type { TaskItem } from '@/app/tasks/types';

/**
 * Normalizes string: lowercases, removes non-alphanumeric chars, trims whitespace.
 */
export function normalizeString(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes string into array of non-empty words.
 */
export function tokenize(str: string): string[] {
  const norm = normalizeString(str);
  if (!norm) return [];
  return norm.split(' ').filter(Boolean);
}

/**
 * Levenshtein distance calculation between two normalized strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates string similarity between 0 and 1.
 */
export function calculateTextSimilarity(textA: string, textB: string): number {
  const normA = normalizeString(textA);
  const normB = normalizeString(textB);

  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  const editDist = levenshteinDistance(normA, normB);
  const levSim = maxLen > 0 ? 1 - editDist / maxLen : 0;

  const tokensA = tokenize(normA);
  const tokensB = tokenize(normB);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersectionCount = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersectionCount++;
  });

  const unionCount = new Set([...tokensA, ...tokensB]).size;
  const jaccard = unionCount > 0 ? intersectionCount / unionCount : 0;

  return jaccard * 0.5 + levSim * 0.5;
}

/**
 * Calculates high-precision task similarity (95% - 100% threshold)
 * comparing BOTH Title AND Description.
 */
export function calculateTaskSimilarity(
  taskA: { title: string; description?: string | null },
  taskB: { title: string; description?: string | null }
): number {
  const titleA = normalizeString(taskA.title);
  const titleB = normalizeString(taskB.title);

  if (!titleA || !titleB) return 0;

  const titleSim = calculateTextSimilarity(taskA.title, taskB.title);

  // If descriptions exist on both, compare them as well
  const descA = normalizeString(taskA.description || '');
  const descB = normalizeString(taskB.description || '');

  if (descA && descB) {
    const descSim = calculateTextSimilarity(descA, descB);
    // Title is 70% weight, Description is 30% weight
    return titleSim * 0.7 + descSim * 0.3;
  }

  // If one has description and other is empty, slight penalty if titles aren't 100% exact
  if ((descA && !descB) || (!descA && descB)) {
    if (titleSim === 1.0) return 0.95; // Exact title match with optional description
    return titleSim * 0.9;
  }

  return titleSim;
}

// Backwards compatibility alias for title-only checks
export const calculateTitleSimilarity = (a: string, b: string) => calculateTextSimilarity(a, b);

export interface SimilarTaskMatch {
  task: TaskItem;
  score: number;
}

/**
 * Finds all active tasks that match a given input (title + description)
 * with strict 95% - 100% threshold (default 0.92 to catch minor typos/singulars).
 */
export function findSimilarTasks(
  query: { title: string; description?: string | null } | string,
  tasks: TaskItem[],
  threshold = 0.92 // 92% - 100% strict threshold
): SimilarTaskMatch[] {
  const queryObj = typeof query === 'string' ? { title: query, description: '' } : query;
  const normQuery = normalizeString(queryObj.title);
  if (!normQuery || normQuery.length < 3) return [];

  const results: SimilarTaskMatch[] = [];

  for (const t of tasks) {
    if (t.is_archived) continue;
    const score = calculateTaskSimilarity(queryObj, { title: t.title, description: t.description });
    if (score >= threshold) {
      results.push({ task: t, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export interface DuplicateCluster {
  id: string; // Unique key for dismissal
  primaryTask: TaskItem;
  duplicateTasks: TaskItem[];
  commonTitle: string;
  matchScore: number;
}

/**
 * Clusters active tasks into groups of high-similarity duplicates (95% - 100% similarity).
 */
export function findDuplicateTaskClusters(tasks: TaskItem[], threshold = 0.92): DuplicateCluster[] {
  const activeTasks = tasks.filter((t) => !t.is_archived);
  const visited = new Set<string>();
  const clusters: DuplicateCluster[] = [];

  for (let i = 0; i < activeTasks.length; i++) {
    const taskA = activeTasks[i];
    if (visited.has(taskA.id)) continue;

    const duplicates: TaskItem[] = [];
    let highestScore = 0;

    for (let j = i + 1; j < activeTasks.length; j++) {
      const taskB = activeTasks[j];
      if (visited.has(taskB.id)) continue;

      const score = calculateTaskSimilarity(
        { title: taskA.title, description: taskA.description },
        { title: taskB.title, description: taskB.description }
      );

      if (score >= threshold) {
        duplicates.push(taskB);
        visited.add(taskB.id);
        if (score > highestScore) highestScore = score;
      }
    }

    if (duplicates.length > 0) {
      visited.add(taskA.id);
      // Pick the task with the most assignments as the recommended primary
      const allInCluster = [taskA, ...duplicates].sort(
        (a, b) => (b.assignments?.length || 0) - (a.assignments?.length || 0)
      );
      clusters.push({
        id: `cluster_${allInCluster[0].id}_${duplicates.map((d) => d.id).join('_')}`,
        primaryTask: allInCluster[0],
        duplicateTasks: allInCluster.slice(1),
        commonTitle: allInCluster[0].title,
        matchScore: highestScore,
      });
    }
  }

  return clusters;
}
