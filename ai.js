'use strict';

const winston = require.main.require('winston');

const DEFAULT_SYSTEM_PROMPT = [
	'You are an articulate writer composing a reply for a NodeBB forum thread. The forum uses Markdown — your output must be valid Markdown (bold, italics, lists, code blocks, links, @mentions, headings, etc., used naturally where appropriate).',
	'Your job is to produce a fully AI-authored version of the message. Treat the input only as a source of MEANING. Everything about HOW it is written — tone, register, voice, punctuation, sentence length, sentence structure, paragraphing, ordering of ideas, transitions, word choice, level of formality, rhythm, and overall length — must be your own writing, NOT a polish of the input. Do not preserve the author\'s phrasing, mannerisms, idioms, sentence breaks, comma habits, ellipses, exclamation marks, or stylistic tics. Do not "lightly improve" the original — rewrite it from scratch as if you were composing a fresh post that happens to convey the same message.',
	'What you MUST preserve: the author\'s intent, position, conclusions, claims, and the actual facts/numbers/names/links they reference. Do not add new claims they didn\'t make, do not drop claims they did make, do not flip their stance or tone of agreement/disagreement, and do not "correct" things you believe are wrong — keep their argument intact even if you disagree with it.',
	'Match the input\'s LANGUAGE (Hebrew → Hebrew, English → English, etc.) but not its STYLE.',
	'Preserve verbatim: code blocks, inline code, URLs, @mentions, and any literal identifiers.',
	'Do NOT add introductions, sign-offs, disclaimers, headers, meta-commentary, or any remark about your rewrite.',
	'Do NOT wrap the output in quotes or in a markdown code fence.',
	'Output ONLY the rewritten reply and nothing else.',
].join('\n\n');

const DEFAULT_SYSTEM_PROMPT_GENERATE = [
	'You are an articulate writer composing a reply for a NodeBB forum thread. The forum uses Markdown — your output must be valid Markdown (bold, italics, lists, code blocks, links, @mentions, headings, etc., used naturally where appropriate).',
	'Your job is to write a BRAND-NEW forum reply based on the thread context (if provided) and the author\'s instruction. You are composing on behalf of the author.',
	'Match the LANGUAGE of the thread context (Hebrew → Hebrew, English → English, etc.).',
	'Preserve verbatim: code blocks, inline code, URLs, @mentions, and any literal identifiers.',
	'Do NOT add introductions, sign-offs, disclaimers, headers, or meta-commentary.',
	'Do NOT wrap the output in quotes or in a markdown code fence.',
	'Output ONLY the composed reply and nothing else.',
].join('\n\n');

const DEFAULT_MODELS = {
	openai: 'gpt-4o-mini',
	anthropic: 'claude-haiku-4-5-20251001',
	gemini: 'gemini-2.5-flash',
};

const DEFAULT_TEMPERATURE = 1.0;

const ai = module.exports;

ai.DEFAULT_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT;
ai.DEFAULT_SYSTEM_PROMPT_GENERATE = DEFAULT_SYSTEM_PROMPT_GENERATE;
ai.DEFAULT_TEMPERATURE = DEFAULT_TEMPERATURE;
ai.DEFAULT_MODELS = DEFAULT_MODELS;

ai.rewrite = async function ({ provider, apiKey, model, text, extraInstruction, systemPrompt, temperature, quotedContext, postsContext }) {
	const chosenModel = (model && model.trim()) || DEFAULT_MODELS[provider];
	const isGenerateMode = !text || !text.trim();
	const chosenSystemPrompt = (systemPrompt && systemPrompt.trim()) ||
		(isGenerateMode ? DEFAULT_SYSTEM_PROMPT_GENERATE : DEFAULT_SYSTEM_PROMPT);
	const chosenTemperature = clampTemperature(temperature);
	const userMessage = buildUserMessage({ text, extraInstruction, quotedContext, postsContext });

	switch (provider) {
		case 'openai':
			return await callOpenAI({ apiKey, model: chosenModel, systemPrompt: chosenSystemPrompt, temperature: chosenTemperature, userMessage });
		case 'anthropic':
			return await callAnthropic({ apiKey, model: chosenModel, systemPrompt: chosenSystemPrompt, temperature: chosenTemperature, userMessage });
		case 'gemini':
			return await callGemini({ apiKey, model: chosenModel, systemPrompt: chosenSystemPrompt, temperature: chosenTemperature, userMessage });
		default:
			throw new Error('[[reply-as-bot:error.ai-not-configured]]');
	}
};

function clampTemperature(value) {
	const num = Number(value);
	if (!Number.isFinite(num)) {
		return DEFAULT_TEMPERATURE;
	}
	return Math.max(0, Math.min(2, num));
}

function buildUserMessage({ text, extraInstruction, quotedContext, postsContext }) {
	const parts = [];

	if (Array.isArray(postsContext) && postsContext.length) {
		const prevPosts = postsContext.filter(p => !p.isTarget);
		const targetPost = postsContext.find(p => p.isTarget);

		parts.push('THREAD CONTEXT (read-only — recent posts from the forum thread shown oldest-first; the block marked ★ is the specific post being replied to. DO NOT echo, quote, or repeat any of these in your output. Use them only to understand the discussion.):');
		parts.push('');

		for (const p of prevPosts) {
			parts.push(`[Post by @${p.username || 'unknown'}]`);
			parts.push(truncate(p.content, 800));
			parts.push('');
		}

		if (targetPost) {
			parts.push(`[★ REPLYING TO THIS — by @${targetPost.username || 'unknown'}]`);
			parts.push(truncate(targetPost.content, 1500));
			parts.push('');
		}
	}

	if (quotedContext && quotedContext.trim()) {
		parts.push('QUOTED PASSAGE (the author is specifically referencing this — context only, do not include in output):');
		parts.push('===QUOTE START===');
		parts.push(quotedContext);
		parts.push('===QUOTE END===');
		parts.push('');
	}

	if (extraInstruction) {
		parts.push(`Author's instruction: ${extraInstruction}`);
		parts.push('');
	}

	if (text && text.trim()) {
		parts.push('Below is the DRAFT MESSAGE to rewrite. Convey the same intent, claims and facts in your own voice — different tone, structure and phrasing. Match the draft\'s language. Output only the new reply in Markdown:');
		parts.push('===DRAFT START===');
		parts.push(text);
		parts.push('===DRAFT END===');
	} else {
		parts.push('No draft provided. Based on the thread context and the author\'s instruction above, compose a brand-new forum reply. Output only the reply in Markdown:');
	}

	return parts.join('\n');
}

function truncate(text, max) {
	const str = String(text || '');
	if (str.length <= max) {
		return str;
	}
	return str.slice(0, max) + '\n[...truncated...]';
}

async function callOpenAI({ apiKey, model, systemPrompt, temperature, userMessage }) {
	const res = await fetchJson('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage },
			],
			temperature,
		}),
	});

	const out = res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
	if (!out) {
		throw makeError(res);
	}
	return cleanOutput(out);
}

async function callAnthropic({ apiKey, model, systemPrompt, temperature, userMessage }) {
	const res = await fetchJson('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify({
			model,
			max_tokens: 4096,
			system: systemPrompt,
			temperature: Math.min(temperature, 1),
			messages: [
				{ role: 'user', content: userMessage },
			],
		}),
	});

	const blocks = res && Array.isArray(res.content) ? res.content : [];
	const out = blocks.filter(b => b && b.type === 'text').map(b => b.text).join('');
	if (!out) {
		throw makeError(res);
	}
	return cleanOutput(out);
}

async function callGemini({ apiKey, model, systemPrompt, temperature, userMessage }) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
	const res = await fetchJson(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: systemPrompt }] },
			contents: [
				{ role: 'user', parts: [{ text: userMessage }] },
			],
			generationConfig: { temperature },
		}),
	});

	const candidates = res && Array.isArray(res.candidates) ? res.candidates : [];
	const parts = candidates[0] && candidates[0].content && Array.isArray(candidates[0].content.parts) ? candidates[0].content.parts : [];
	const out = parts.map(p => p && p.text).filter(Boolean).join('');
	if (!out) {
		throw makeError(res);
	}
	return cleanOutput(out);
}

async function fetchJson(url, options) {
	let response;
	try {
		response = await fetch(url, options);
	} catch (err) {
		winston.warn(`[reply-as-bot] AI request failed: ${err.message}`);
		throw new Error('[[reply-as-bot:error.ai-request-failed]]');
	}

	const text = await response.text();
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch (err) {
		winston.warn(`[reply-as-bot] AI returned non-JSON (status ${response.status}): ${text.slice(0, 200)}`);
		throw new Error('[[reply-as-bot:error.ai-request-failed]]');
	}

	if (!response.ok) {
		const message = (json && json.error && (json.error.message || json.error)) || `HTTP ${response.status}`;
		winston.warn(`[reply-as-bot] AI error: ${typeof message === 'string' ? message : JSON.stringify(message)}`);
		throw new Error('[[reply-as-bot:error.ai-request-failed]]');
	}

	return json;
}

function makeError(res) {
	winston.warn(`[reply-as-bot] AI returned no text: ${JSON.stringify(res).slice(0, 300)}`);
	return new Error('[[reply-as-bot:error.ai-empty-response]]');
}

function cleanOutput(text) {
	let out = String(text || '').trim();
	out = out.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
	return out;
}
