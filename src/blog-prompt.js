// The ChatGPT prompt behind the Blog Editor's scissors button, and the parser that turns its answer back into a post.
// Placeholders: {{TITLE}} and {{KEYWORD}}.
export const BLOG_PROMPT = `You are an experienced SEO content writer creating a publish-ready blog for the company below.

WEBSITE:
northstarhouse.org

BRAND OVERVIEW:
Location: Nevada County, CA

PROPOSED BLOG TITLE:
{{TITLE}}

OPTIONAL TARGET KEYWORD:
{{KEYWORD}}

Before writing, research the company and its existing content.

WEBSITE AND BLOG RESEARCH

1. Review the company's main website pages, including:

- Homepage
- About page
- Relevant service pages
- Location or service-area pages
- Contact page
- Blog archive
- Any other pages relevant to the proposed topic

2. Find the company's full blog archive. Check the main blog page, category pages, pagination, and older archive pages when available.

3. Review the titles of all previously published blog posts.

Use the existing blog titles to determine whether the proposed topic has already been covered or is too similar to a previous article.

Do not suggest or write a blog with the same topic, question, or clearly overlapping angle as an existing blog title.

If the proposed title is too similar to an existing post, adjust the angle while keeping the general subject relevant. The revised article should answer a different customer question, address a different audience, focus on a more specific situation, or approach the topic from a clearly different perspective.

4. Identify the three most recently published blog posts and read each one in full.

Use these three posts to understand the company's current brand voice, including:

- Tone and personality
- Sentence and paragraph length
- Vocabulary
- Level of detail
- Formatting style
- How the company is mentioned
- How promotional the writing feels
- How calls to action are handled

Match the general voice and level of formality without copying exact wording, sentences, headings, examples, or structure.

5. Verify company facts before using them. Do not invent:

- Services
- Locations
- Certifications
- Pricing
- Guarantees
- Experience
- Staff details
- Equipment
- Processes
- Results
- Policies

If a detail cannot be confirmed on the website or in the brand overview, leave it out.

WRITING STYLE

Write naturally and conversationally.
Sound like an experienced human writer, not an AI copywriter.
Answer the main question or give the main solution in the first paragraph.
Be useful before being promotional.
Use practical details, examples, distinctions, and clear explanations.
Assume the reader is intelligent.
Keep the writing straightforward.
Use contractions naturally.
Vary sentence and paragraph length.
Write with restraint.
Do not use em dashes.
Do not write in obvious groups of three.
Do not force symmetry.
Do not use cheesy hooks.
Do not open with "Imagine."
Do not write inspirational conclusions.
Do not overexplain obvious ideas.
Do not repeat the same sentence structure.
Do not stuff keywords.
Avoid generic marketing language.

Avoid these phrases: can help, may help, is designed to, offers a range of, provides peace of mind, more than just, not only... but also..., in today's world, when it comes to, at the end of the day, it's important to note, additionally, furthermore, moreover.

If a sentence sounds robotic, overly polished, repetitive, formal, vague, or generic, rewrite it more simply.

Do not start 3 or more consecutive sentences with the same word (this includes consecutive sentences across paragraph breaks). Vary sentence openers throughout the article.

Keep passive voice under 10% of sentences. Default to active voice — the subject doing the action, not having it done to it (e.g. "our team installs the system" rather than "the system is installed by our team").

SEO AND CONTENT REQUIREMENTS

Write approximately 1250 words unless the topic requires a slightly different length.

Choose one natural focus keyword based on the proposed title, the company's actual services, and realistic search intent.

Use the focus keyword naturally in:

- The first paragraph
- At least one H2
- The body where relevant
- The SEO title
- The meta description

Do not force an exact-match keyword into sentences where it sounds unnatural.

Include at least two relevant internal links. Link naturally to actual pages on the company's website using descriptive anchor text.

Include one authoritative external link when it adds useful supporting information. Do not link to a direct competitor.

The external source should be a credible government agency, university, professional association, standards organization, manufacturer documentation page, or similarly authoritative resource.

Place every internal and external link directly inside the relevant body copy rather than listing links separately.

Write every link as an inline Markdown link directly on its anchor text, e.g. [anchor text](https://example.com/page). Do not use bracketed reference-style citations (e.g. "([Source][1])" or a numbered footnote/reference list at the end) — those don't render as real links here.

OUTPUT FORMAT

Return the finished blog package using this exact format:

TITLE: [Reader-facing blog title]

SEO_TITLE: [SEO title that accurately describes the article]

META_DESCRIPTION: [Compelling description of approximately 150-160 characters]

SLUG: [Short, lowercase, hyphenated URL slug]

CATEGORY: [Most appropriate category]

TAGS: [Comma-separated tags]

FOCUS_KEYWORD: [Primary target keyword]

BODY:
[Complete publish-ready article]

BODY FORMATTING

Use Markdown headings.

Use ## for H2 headings.

Use ### only when a subsection genuinely needs an H3.

Do not bold any text in the body. No **asterisks** for emphasis anywhere — headings alone are enough structure.

Avoid stock AI-sounding rhetorical constructions, especially "The goal isn't to ___, it's to ___" (and close variants like "It's not just about ___, it's about ___" or "This isn't just ___"). State the point directly instead of setting up a false contrast to knock down.

Leave a blank line between every paragraph.

Do not include a table of contents unless the article is unusually long or technically complex.

Do not label the opening paragraphs as "Introduction."

Mention the company naturally near the beginning when appropriate.

Do not insert the company name awkwardly into every section.

This blog is published on the company's own website, written from the company's perspective. When referring to the company itself, write in first person plural ("we," "our," "us") — never address the company as "you." Reserve "you" for speaking directly to the reader/customer.

It's fine, and encouraged, to use the company name by itself too. But when you do, phrase it the way the company would actually talk about itself, not like a third-party profile describing it from the outside. Avoid constructions like "[Company] lists X as its Y" or "[Company] offers X" — instead write things like "At [Company], we offer X" or "our team at [Company] handles X." The name should sit naturally inside a first-person sentence, not replace "we" as the subject of an outside-looking-in description.

Return to the company near the end with a relevant and restrained call to action.

End with a useful, specific conclusion rather than a generic inspirational statement.

FUTURE BLOG IDEAS

After the complete blog package, suggest three additional blog titles for the company.

Before suggesting them, compare each idea against the titles in the existing blog archive.

Each suggested title must:

- Be meaningfully different from all existing blog titles
- Avoid duplicating the article just written
- Relate directly to a confirmed company service or customer concern
- Have clear search intent
- Address a specific question, situation, or problem
- Avoid generic topics that could apply to almost any business

For each idea, provide:

PROPOSED TITLE: [Title]

PRIMARY KEYWORD OR SEARCH QUESTION: [Keyword or question]

UNIQUE ANGLE: [One sentence explaining what the article would cover and why it is different from existing posts]

Suggest exactly three ideas. Do not write the additional blogs.`;

export function buildBlogPrompt(title, keyword) {
  return BLOG_PROMPT.replace('{{TITLE}}', String(title || '').trim()).replace('{{KEYWORD}}', String(keyword || '').trim());
}

const escHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(t) {
  return escHtml(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|mailto:[^\s)]+)\)/g, (m, text, url) => '<a href="' + url.replace(/"/g, '%22') + '">' + text + '</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

// Markdown (headings, paragraphs, lists, links) -> the HTML the editor stores.
export function markdownToHtml(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // 'ul' | 'ol'
  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if (!line) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flushPara(); flushList();
      const level = Math.min(4, Math.max(2, m[1].length)); // the page title is the H1, so body headings start at H2
      out.push('<h' + level + '>' + inline(m[2].replace(/\*\*/g, '')) + '</h' + level + '>');
    } else if ((m = line.match(/^[-*•]\s+(.*)$/))) {
      flushPara();
      if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; }
      out.push('<li>' + inline(m[1]) + '</li>');
    } else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; }
      out.push('<li>' + inline(m[1]) + '</li>');
    } else if (/^[-_*]{3,}$/.test(line)) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();
  return out.join('\n');
}

// Reads ChatGPT's answer (TITLE:, SEO_TITLE:, ... BODY:) and returns the pieces; the future-ideas section is dropped.
export function parseBlogPackage(text) {
  const t = String(text || '').replace(/\r\n/g, '\n');
  const bodyAt = t.search(/^\W*BODY\W*:/m);
  const head = bodyAt >= 0 ? t.slice(0, bodyAt) : t;
  const field = (label) => {
    const m = head.match(new RegExp('^\\W*' + label + '\\W*:[ \\t]*(.*)$', 'mi'));
    return m ? m[1].replace(/\*\*/g, '').replace(/^\[|\]$/g, '').trim() : '';
  };
  let body = '';
  if (bodyAt >= 0) {
    body = t.slice(bodyAt).replace(/^\W*BODY\W*:[ \t]*/i, '');
    const end = body.search(/^\W*(FUTURE BLOG IDEAS|PROPOSED TITLE\W*:)/mi);
    if (end >= 0) body = body.slice(0, end);
    body = body.replace(/\n\s*[-_*]{3,}\s*$/, '').trim();
  }
  return {
    title: field('TITLE'), seo_title: field('SEO_TITLE'), seo_description: field('META_DESCRIPTION'), slug: field('SLUG'),
    category: field('CATEGORY'), tags: field('TAGS'), focus_keyword: field('FOCUS_KEYWORD'), body_md: body,
  };
}
