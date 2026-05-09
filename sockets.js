'use strict';

const db = require.main.require('./src/database');
const meta = require.main.require('./src/meta');
const user = require.main.require('./src/user');
const groups = require.main.require('./src/groups');
const posts = require.main.require('./src/posts');

const library = require('./library');
const ai = require('./ai');

const TEMPLATE_SET = 'reply-as-bot:templates';
const TEMPLATE_KEY = 'reply-as-bot:template:';

const sockets = module.exports;

sockets.getState = async function (socket) {
	const settings = await library.getSettings();
	const botUid = await library.getBotUid(settings.botUsername);
	const canUse = await library.canUse(socket.uid, settings.allowedGroups);
	const isAdmin = await user.isAdministrator(socket.uid);

	const state = {
		canUse,
		botUsername: settings.botUsername,
		botUid,
		iconClass: settings.iconClass,
		templates: await getTemplates(),
		aiEnabled: settings.aiEnabled && !!settings.aiApiKey && !!settings.aiProvider,
	};

	if (isAdmin) {
		state.admin = {
			aiEnabled: settings.aiEnabled,
			aiProvider: settings.aiProvider,
			aiModel: settings.aiModel,
			aiKeyConfigured: !!settings.aiApiKey,
		};
	}

	return state;
};

sockets.saveSettings = async function (socket, data) {
	if (!await user.isAdministrator(socket.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	const botUsername = String(data && data.botUsername || '').trim();
	const allowedGroups = Array.isArray(data && data.allowedGroups) ? data.allowedGroups.map(String) : [];
	const iconClass = normalizeIconClass(data && data.iconClass);
	const botUid = await library.getBotUid(botUsername);
	if (!botUid) {
		throw new Error('[[reply-as-bot:error.select-valid-bot-user]]');
	}

	const exists = await groups.exists(allowedGroups);
	const validGroups = allowedGroups.filter((groupName, index) => exists[index]);
	if (!validGroups.length) {
		throw new Error('[[reply-as-bot:error.select-allowed-group]]');
	}

	const aiEnabled = !!(data && data.aiEnabled);
	const aiProvider = library.normalizeProvider(data && data.aiProvider);
	const aiModel = String(data && data.aiModel || '').trim();

	const current = await library.getSettings();
	let aiApiKey = current.aiApiKey || '';
	const incomingKey = data && typeof data.aiApiKey === 'string' ? data.aiApiKey : '';
	if (incomingKey === '__CLEAR__') {
		aiApiKey = '';
	} else if (incomingKey.trim()) {
		aiApiKey = incomingKey.trim();
	}

	if (aiEnabled && !aiApiKey) {
		throw new Error('[[reply-as-bot:error.ai-key-required]]');
	}

	const incomingPrompt = String(data && data.aiSystemPrompt || '').trim();
	const ai = require('./ai');
	const aiSystemPrompt = !incomingPrompt || incomingPrompt === ai.DEFAULT_SYSTEM_PROMPT.trim() ? '' : incomingPrompt;

	const incomingTemp = data && data.aiTemperature !== undefined && data.aiTemperature !== null ? String(data.aiTemperature).trim() : '';
	let aiTemperature = '';
	if (incomingTemp !== '') {
		const tempNum = Number(incomingTemp);
		if (!Number.isFinite(tempNum) || tempNum < 0 || tempNum > 2) {
			throw new Error('[[reply-as-bot:error.ai-invalid-temperature]]');
		}
		if (tempNum !== ai.DEFAULT_TEMPERATURE) {
			aiTemperature = String(tempNum);
		}
	}

	await meta.settings.set('reply-as-bot', {
		botUsername,
		allowedGroups: validGroups,
		iconClass,
		aiEnabled,
		aiProvider,
		aiModel,
		aiApiKey,
		aiSystemPrompt,
		aiTemperature,
	});

	return {
		botUsername,
		allowedGroups: validGroups,
		iconClass,
		aiEnabled,
		aiProvider,
		aiModel,
		aiKeyConfigured: !!aiApiKey,
	};
};

sockets.saveTemplate = async function (socket, data) {
	await assertCanUse(socket.uid);

	const title = String(data && data.title || '').trim();
	const text = String(data && data.text || '').trim();
	if (!title || !text) {
		throw new Error('[[reply-as-bot:error.template-title-text-required]]');
	}

	const id = data && data.id ? String(data.id) : String(await db.incrObjectField('global', 'nextReplyAsBotTemplateId'));
	const template = {
		id,
		title,
		text,
		uid: socket.uid,
		updated: Date.now(),
	};

	await db.setObject(`${TEMPLATE_KEY}${id}`, template);
	await db.sortedSetAdd(TEMPLATE_SET, template.updated, id);
	return template;
};

sockets.deleteTemplate = async function (socket, data) {
	await assertCanUse(socket.uid);

	const id = String(data && data.id || '');
	if (!id) {
		throw new Error('[[reply-as-bot:error.invalid-template]]');
	}

	await db.sortedSetRemove(TEMPLATE_SET, id);
	await db.delete(`${TEMPLATE_KEY}${id}`);
};

sockets.aiRewrite = async function (socket, data) {
	await assertCanUse(socket.uid);

	const settings = await library.getSettings();
	if (!settings.aiEnabled || !settings.aiApiKey || !settings.aiProvider) {
		throw new Error('[[reply-as-bot:error.ai-not-configured]]');
	}

	const text = String(data && data.text || '');
	const { quote, body } = splitQuoteAndBody(text);
	if (!body.trim()) {
		throw new Error('[[reply-as-bot:error.ai-empty-text]]');
	}

	const extraInstruction = String(data && data.instruction || '').trim();
	const parentPost = await loadParentPost(parseInt(data && data.toPid, 10));

	const rewritten = await ai.rewrite({
		provider: settings.aiProvider,
		apiKey: settings.aiApiKey,
		model: settings.aiModel,
		text: body,
		extraInstruction,
		systemPrompt: settings.aiSystemPrompt,
		temperature: settings.aiTemperature,
		quotedContext: quote,
		parentPost,
	});

	return { text: rewritten };
};

function splitQuoteAndBody(text) {
	const lines = String(text || '').split(/\r?\n/);
	const quoteLines = [];
	const bodyLines = [];
	for (const line of lines) {
		if (/^\s*>(\s|$)/.test(line)) {
			quoteLines.push(line);
		} else {
			bodyLines.push(line);
		}
	}
	return {
		quote: quoteLines.join('\n').trim(),
		body: bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
	};
}

async function loadParentPost(pid) {
	if (!pid || !Number.isFinite(pid)) {
		return null;
	}
	try {
		const fields = await posts.getPostFields(pid, ['content', 'uid', 'deleted']);
		if (!fields || !fields.content || parseInt(fields.deleted, 10) === 1) {
			return null;
		}
		let username = '';
		if (fields.uid) {
			const u = await user.getUserFields(fields.uid, ['username']);
			username = (u && u.username) || '';
		}
		return { content: String(fields.content), username };
	} catch (err) {
		return null;
	}
}

async function assertCanUse(uid) {
	const settings = await library.getSettings();
	if (!await library.canUse(uid, settings.allowedGroups)) {
		throw new Error('[[error:no-privileges]]');
	}
}

async function getTemplates() {
	const ids = await db.getSortedSetRevRange(TEMPLATE_SET, 0, -1);
	if (!ids.length) {
		return [];
	}

	const templates = await db.getObjects(ids.map(id => `${TEMPLATE_KEY}${id}`));
	const uids = templates.map(template => template && template.uid).filter(Boolean);
	const users = uids.length ? await user.getUsersFields(uids, ['uid', 'username']) : [];
	const userMap = Object.fromEntries(users.map(userData => [String(userData.uid), userData.username]));

	return templates.filter(Boolean).map(template => ({
		...template,
		username: userMap[String(template.uid)] || '',
	}));
}

function normalizeIconClass(iconClass) {
	iconClass = String(iconClass || '').trim();
	if (
		!/^(fa-[a-z0-9-]+)(\s+(fa|fas|far|fab|fa-solid|fa-regular|fa-brands))*$/i.test(iconClass) ||
		iconClass.includes('fa-nbb-none')
	) {
		return 'fa-robot';
	}
	return iconClass;
}
