'use strict';

const db = require.main.require('./src/database');
const meta = require.main.require('./src/meta');
const user = require.main.require('./src/user');
const groups = require.main.require('./src/groups');

const library = require('./library');

const TEMPLATE_SET = 'reply-as-bot:templates';
const TEMPLATE_KEY = 'reply-as-bot:template:';

const sockets = module.exports;

sockets.getState = async function (socket) {
	const settings = await library.getSettings();
	const botUid = await library.getBotUid(settings.botUsername);
	const canUse = await library.canUse(socket.uid, settings.allowedGroups);

	return {
		canUse,
		botUsername: settings.botUsername,
		botUid,
		iconClass: settings.iconClass,
		templates: await getTemplates(),
	};
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
		throw new Error('יש לבחור שם משתמש קיים עבור הבוט.');
	}

	const exists = await groups.exists(allowedGroups);
	const validGroups = allowedGroups.filter((groupName, index) => exists[index]);
	if (!validGroups.length) {
		throw new Error('יש לבחור לפחות קבוצה מורשית אחת.');
	}

	await meta.settings.set('reply-as-bot', {
		botUsername,
		allowedGroups: validGroups,
		iconClass,
	});

	return {
		botUsername,
		allowedGroups: validGroups,
		iconClass,
	};
};

sockets.saveTemplate = async function (socket, data) {
	await assertCanUse(socket.uid);

	const title = String(data && data.title || '').trim();
	const text = String(data && data.text || '').trim();
	if (!title || !text) {
		throw new Error('יש למלא כותרת וטקסט לתבנית.');
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
		throw new Error('תבנית לא תקינה.');
	}

	await db.sortedSetRemove(TEMPLATE_SET, id);
	await db.delete(`${TEMPLATE_KEY}${id}`);
};

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
		return 'fa-user-secret';
	}
	return iconClass;
}
