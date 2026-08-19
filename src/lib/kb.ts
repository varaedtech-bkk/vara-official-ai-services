import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Dependency-free knowledge retrieval over the markdown corpus in /knowledge.
 *
 * The corpus is read from disk at first use and cached in module scope, so
 * editing a markdown file only needs a process restart (pm2 reload), not a
 * rebuild. See DEPLOY.md — the `knowledge/` directory must sit next to the
 * server process working directory.
 */

export type KbChunk = {
  docId: string;
  docTitle: string;
  heading: string;
  text: string;
  tags: string[];
  lang: 'core' | 'th';
};

export type KbHit = KbChunk & { score: number };

/* ------------------------------------------------------------ corpus load */

const CANDIDATE_ROOTS = [
  join(process.cwd(), 'knowledge'),
  join(process.cwd(), '..', 'knowledge'),
  join(process.cwd(), '..', '..', 'knowledge'),
];

function knowledgeRoot(): string | null {
  for (const root of CANDIDATE_ROOTS) {
    if (existsSync(root)) return root;
  }
  return null;
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith('---')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: raw };

  const block = raw.slice(3, end);
  const body = raw.slice(end + 4);
  const meta: Record<string, string> = {};

  for (const line of block.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }
  return { meta, body };
}

function parseTags(value?: string): string[] {
  if (!value) return [];
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Split a document body into chunks at `##` headings. */
function chunkDocument(
  body: string,
  meta: Record<string, string>,
  lang: KbChunk['lang'],
  fallbackId: string
): KbChunk[] {
  const docId = meta.id || fallbackId;
  const docTitle = meta.title || fallbackId;
  const tags = parseTags(meta.tags);

  const lines = body.split('\n');
  const chunks: KbChunk[] = [];

  let heading = docTitle;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text.length > 40) {
      chunks.push({ docId, docTitle, heading, text, tags, lang });
    }
    buffer = [];
  };

  // Any heading level starts a new chunk. Level-1 headings are used inside
  // these documents as major section breaks (e.g. "# The 9 campus ideas"), so
  // treating only ## and ### as boundaries would glue whole sections together.
  for (const line of lines) {
    const match = /^(#{1,4})\s+(.*)$/.exec(line);
    if (match) {
      flush();
      heading = match[2].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return chunks;
}

let cache: KbChunk[] | null = null;

export function loadKnowledge(): KbChunk[] {
  if (cache) return cache;

  const root = knowledgeRoot();
  if (!root) {
    console.error(
      '[kb] knowledge/ directory not found. Looked in:\n  ' + CANDIDATE_ROOTS.join('\n  ')
    );
    cache = [];
    return cache;
  }

  const chunks: KbChunk[] = [];

  for (const folder of ['core', 'th'] as const) {
    const dir = join(root, folder);
    if (!existsSync(dir)) continue;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const raw = readFileSync(join(dir, file), 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      chunks.push(...chunkDocument(body, meta, folder, file.replace(/\.md$/, '')));
    }
  }

  cache = chunks;
  return chunks;
}

/* --------------------------------------------------------------- scoring */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'is', 'are',
  'was', 'were', 'do', 'does', 'did', 'what', 'how', 'can', 'you', 'your',
  'we', 'our', 'with', 'about', 'me', 'my', 'i', 'it', 'that', 'this', 'be',
  'have', 'has', 'tell', 'give', 'please', 'much', 'many', 'any', 'get',
]);

/**
 * Very light English suffix stripping, so "clients" matches "client work" and
 * "pricing" matches "price". Deliberately conservative — an aggressive stemmer
 * would collapse distinct product terms.
 */
function stem(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses') || word.endsWith('ches') || word.endsWith('shes')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('ing') && word.length > 6) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 5) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Tokenise for scoring. Latin words are split normally and stemmed; Thai has
 * no spaces, so Thai runs are additionally emitted as overlapping character
 * bigrams, which is a crude but effective substitute for a word segmenter.
 */
function tokenize(input: string): string[] {
  const lower = input.toLowerCase();
  const tokens: string[] = [];

  const latin = lower.match(/[a-z0-9]+/g) || [];
  for (const word of latin) {
    if (word.length > 1 && !STOP_WORDS.has(word)) tokens.push(stem(word));
  }

  const thaiRuns = lower.match(/[฀-๿]+/g) || [];
  for (const run of thaiRuns) {
    if (run.length <= 2) {
      tokens.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i += 1) {
      tokens.push(run.slice(i, i + 2));
    }
  }

  return tokens;
}

/**
 * Precomputed per-chunk index plus corpus-wide inverse document frequency.
 *
 * IDF matters a lot here: "university" appears in nearly every document, while
 * "cost" appears in one. Without it, a question like "how much does a
 * university workshop cost" ranks the university document above the pricing
 * document purely on repetition.
 */
type ChunkIndex = {
  counts: Map<string, number>;
  headingTokens: Set<string>;
  titleTokens: Set<string>;
  tagTokens: Set<string>;
  length: number;
};

let indexCache: { chunks: KbChunk[]; index: ChunkIndex[]; idf: Map<string, number> } | null = null;

function buildIndex() {
  if (indexCache) return indexCache;

  const chunks = loadKnowledge();
  const index: ChunkIndex[] = [];
  const docFreq = new Map<string, number>();

  for (const chunk of chunks) {
    const bodyTokens = tokenize(`${chunk.docTitle}\n${chunk.heading}\n${chunk.text}`);
    const counts = new Map<string, number>();
    for (const token of bodyTokens) counts.set(token, (counts.get(token) || 0) + 1);

    for (const token of counts.keys()) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }

    index.push({
      counts,
      // Section heading and document title are scored separately: the title is
      // shared by every chunk in a file, so weighting them equally would make
      // all sections of a document tie and let chunk length pick the winner.
      headingTokens: new Set(tokenize(chunk.heading)),
      titleTokens: new Set(tokenize(chunk.docTitle)),
      tagTokens: new Set(chunk.tags.flatMap((tag) => tokenize(tag))),
      length: bodyTokens.length,
    });
  }

  const total = Math.max(chunks.length, 1);
  const idf = new Map<string, number>();
  for (const [token, freq] of docFreq) {
    // Smoothed IDF, floored so a ubiquitous term still counts a little.
    idf.set(token, Math.max(0.25, Math.log((total + 1) / (freq + 0.5))));
  }

  indexCache = { chunks, index, idf };
  return indexCache;
}

function scoreChunk(entry: ChunkIndex, queryTokens: string[], idf: Map<string, number>): number {
  let score = 0;
  let matched = 0;

  for (const token of queryTokens) {
    const weight = idf.get(token) ?? 1.5; // unseen term: treat as fairly rare
    const tf = entry.counts.get(token) || 0;
    let hit = false;

    if (tf > 0) {
      hit = true;
      // Saturating term frequency so one long chunk can't dominate.
      score += (1 + Math.log(1 + tf)) * weight;
    }
    if (entry.headingTokens.has(token)) {
      hit = true;
      score += 3.0 * weight;
    }
    if (entry.tagTokens.has(token)) {
      hit = true;
      score += 1.5 * weight;
    }
    if (entry.titleTokens.has(token)) {
      hit = true;
      score += 0.75 * weight;
    }

    // A heading- or tag-only match still counts as covering the query. Without
    // this, a section that is clearly about the topic but never repeats the
    // exact word in its body would be discarded entirely.
    if (hit) matched += 1;
  }

  if (!matched) return 0;

  // Reward chunks that cover more of the query, and mildly penalise very long
  // chunks so a focused section beats a sprawling one.
  const coverage = matched / queryTokens.length;
  const lengthPenalty = 1 / (1 + Math.log(1 + entry.length / 120));

  return score * (0.5 + coverage) * lengthPenalty;
}

export function searchKnowledge(
  query: string,
  options: { limit?: number; lang?: 'en' | 'th' } = {}
): KbHit[] {
  const { limit = 5, lang = 'en' } = options;
  const { chunks, index, idf } = buildIndex();
  const queryTokens = tokenize(query);

  if (!chunks.length || !queryTokens.length) return [];

  const hits: KbHit[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    let score = scoreChunk(index[i], queryTokens, idf);
    if (score <= 0) continue;
    // Nudge the Thai localisation layer up when answering in Thai.
    if (lang === 'th' && chunk.lang === 'th') score *= 1.25;
    hits.push({ ...chunk, score });
  }

  hits.sort((a, b) => b.score - a.score);

  // Prefer breadth: at most 2 chunks from any single document.
  const perDoc = new Map<string, number>();
  const selected: KbHit[] = [];
  for (const hit of hits) {
    const used = perDoc.get(hit.docId) || 0;
    if (used >= 2) continue;
    perDoc.set(hit.docId, used + 1);
    selected.push(hit);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function formatSkillsForVoice(
  skills: { title: string; body: string }[],
  query: string,
): string {
  const q = query.toLowerCase();
  const matched = skills.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.body.toLowerCase().includes(q) ||
      q.split(/\s+/).some((w) => w.length > 3 && (s.title + s.body).toLowerCase().includes(w)),
  );
  const pick = matched.length ? matched : skills.slice(0, 4);
  if (!pick.length) {
    return 'No client skills are configured for this workspace. Answer from what you already know, or offer to take their details.';
  }
  return pick.map((s) => `## ${s.title}\n${s.body}`).join('\n\n---\n\n').slice(0, 4000);
}

/** Render hits as compact plain text for a voice model to read from. */
export function formatHitsForVoice(hits: KbHit[]): string {
  if (!hits.length) {
    return 'No matching information found in the VARA knowledge base. Tell the caller you would rather have a specialist confirm it than guess, and offer to take their details.';
  }
  return hits
    .map((hit) => `## ${hit.docTitle} — ${hit.heading}\n${hit.text.trim()}`)
    .join('\n\n---\n\n')
    .slice(0, 6000);
}
