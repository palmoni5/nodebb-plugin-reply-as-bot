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

	const aiReady = settings.aiEnabled && !!settings.aiApiKey && !!settings.aiProvider;
	const state = {
		canUse,
		botUsername: settings.botUsername,
		botUid,
		iconClass: settings.iconClass,
		templates: await getTemplates(),
		aiEnabled: aiReady,
		aiOnlyMode: aiReady && !!settings.aiOnlyMode,
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
	const aiOnlyMode = !!(data && data.aiOnlyMode);
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
		aiOnlyMode,
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
		aiOnlyMode,
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
	const extraInstruction = String(data && data.instruction || '').trim();

	if (!body.trim() && !extraInstruction) {
		throw new Error('[[reply-as-bot:error.ai-empty-text]]');
	}

	const postsContext = await loadPostsContext(parseInt(data && data.toPid, 10));

	const rewritten = await ai.rewrite({
		provider: settings.aiProvider,
		apiKey: settings.aiApiKey,
		model: settings.aiModel,
		text: body,
		extraInstruction,
		systemPrompt: settings.aiSystemPrompt,
		temperature: settings.aiTemperature,
		quotedContext: quote,
		postsContext,
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

async function loadPostsContext(pid) {
	if (!pid || !Number.isFinite(pid)) {
		return [];
	}
	try {
		const parentFields = await posts.getPostFields(pid, ['content', 'uid', 'deleted', 'tid']);
		if (!parentFields || !parentFields.content || parseInt(parentFields.deleted, 10) === 1) {
			return [];
		}

		const tid = parseInt(parentFields.tid, 10);
		const allPids = await db.getSortedSetRange(`tid:${tid}:posts`, 0, -1);
		const idx = allPids.indexOf(String(pid));
		const prevPids = idx > 0 ? allPids.slice(Math.max(0, idx - 3), idx) : [];

		const pidsToLoad = [...prevPids, String(pid)];
		const postFieldsArr = await Promise.all(
			pidsToLoad.map(p => posts.getPostFields(parseInt(p, 10), ['content', 'uid', 'deleted']))
		);

		const uids = postFieldsArr.map(p => p && p.uid).filter(Boolean);
		const usersData = uids.length ? await user.getUsersFields(uids, ['uid', 'username']) : [];
		const userMap = Object.fromEntries(usersData.map(u => [String(u.uid), u.username]));

		return postFieldsArr
			.map((p, i) => ({
				content: String((p && p.content) || ''),
				username: p ? (userMap[String(p.uid)] || '') : '',
				isTarget: i === pidsToLoad.length - 1,
				deleted: !p || parseInt(p.deleted, 10) === 1,
			}))
			.filter(p => !p.deleted && p.content);
	} catch (err) {
		return [];
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
