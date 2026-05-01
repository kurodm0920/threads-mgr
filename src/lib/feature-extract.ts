export interface RuleFeatures {
  body_length: number;
  emoji_count: number;
  hashtag_count: number;
  newline_count: number;
  question_count: number;
  has_cta: boolean;
  has_url: boolean;
  cta_position: 'top' | 'middle' | 'bottom' | 'none';
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const URL_RE = /https?:\/\/\S+/g;
const HASHTAG_RE = /#\S+/g;
const QUESTION_RE = /[?？]/g;

export function extractRuleFeatures(
  body: string,
  hasCta: boolean
): RuleFeatures {
  const body_length = [...body].length;
  const emoji_count = (body.match(EMOJI_RE) ?? []).length;
  const hashtag_count = (body.match(HASHTAG_RE) ?? []).length;
  const newline_count = (body.match(/\n/g) ?? []).length;
  const question_count = (body.match(QUESTION_RE) ?? []).length;
  const urlMatch = body.match(URL_RE);
  const has_url = urlMatch !== null;

  let cta_position: RuleFeatures['cta_position'] = 'none';
  if (hasCta && urlMatch) {
    const urlPos = body.indexOf(urlMatch[0]);
    const ratio = body_length > 0 ? urlPos / body_length : 0;
    if (ratio < 0.33) cta_position = 'top';
    else if (ratio > 0.67) cta_position = 'bottom';
    else cta_position = 'middle';
  }

  return {
    body_length,
    emoji_count,
    hashtag_count,
    newline_count,
    question_count,
    has_cta: hasCta,
    has_url,
    cta_position,
  };
}
