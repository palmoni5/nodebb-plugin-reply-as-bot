'use strict';

const meta = require.main.require('./src/meta');
const user = require.main.require('./src/user');
const groups = require.main.require('./src/groups');
const privileges = require.main.require('./src/privileges');
const events = require.main.require('./src/events');
const SocketPlugins = require.main.require('./src/socket.io/plugins');

const sockets = require('./sockets');
const controllers = require('./controllers');

const SETTINGS_KEY = 'reply-as-bot';

const plugin = module.exports;

plugin.init = async function ({ router }) {
	const routeHelpers = require.main.require('./src/routes/helpers');

	SocketPlugins.replyAsBot = sockets;
	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/reply-as-bot', controllers.renderAdminPage);
};

plugin.addAdminNavigation = async function (header) {
	header.plugins.push({
		route: '/plugins/reply-as-bot',
		icon: 'fa-user-secret',
		name: '[[reply-as-bot:admin.title]]',
	});
	return header;
};

plugin.filterTopicReply = async function (data) {
	if (!data || !data.replyAsBot) {
		return data;
	}

	const actorUid = parseInt(data.uid, 10);
	if (!actorUid) {
		throw new Error('[[error:no-privileges]]');
	}

	const settings = await getSettings();
	const botUid = await getBotUid(settings.botUsername);
	if (!botUid) {
		throw new Error('[[reply-as-bot:error.bot-user-invalid]]');
	}

	const allowed = await canUse(actorUid, settings.allowedGroups);
	if (!allowed) {
		throw new Error('[[error:no-privileges]]');
	}

	const actorCanReply = await privileges.topics.can('topics:reply', data.tid, actorUid);
	if (!actorCanReply) {
		throw new Error('[[error:no-privileges]]');
	}

	data.replyAsBotActorUid = actorUid;
	data.uid = botUid;
	return data;
};

plugin.markBotReplyPost = async function (hookData) {
	if (!hookData || !hookData.data || !hookData.data.replyAsBotActorUid) {
		return hookData;
	}

	hookData.post.replyAsBot = 1;
	hookData.post.replyAsBotActorUid = hookData.data.replyAsBotActorUid;
	return hookData;
};

plugin.logBotReply = async function ({ post }) {
	if (!post || !post.replyAsBot || !post.replyAsBotActorUid) {
		return;
	}

	await events.log({
		type: 'reply-as-bot',
		uid: post.replyAsBotActorUid,
		pid: post.pid,
		targetUid: post.uid,
		tid: post.tid,
	});
};

plugin.getSettings = getSettings;
plugin.canUse = canUse;
plugin.getBotUid = getBotUid;

async function getSettings() {
	const settings = await meta.settings.get(SETTINGS_KEY);
	return {
		botUsername: String(settings.botUsername || '').trim(),
		allowedGroups: parseGroups(settings.allowedGroups),
		iconClass: normalizeIconClass(settings.iconClass),
	};
}

async function getBotUid(username) {
	username = String(username || '').trim();
	if (!username) {
		return 0;
	}
	return parseInt(await user.getUidByUsername(username), 10) || 0;
}

async function canUse(uid, allowedGroups) {
	if (!parseInt(uid, 10) || !Array.isArray(allowedGroups) || !allowedGroups.length) {
		return false;
	}
	return await groups.isMemberOfAny(uid, allowedGroups);
}

function parseGroups(value) {
	if (Array.isArray(value)) {
		return value.map(String).map(group => group.trim()).filter(Boolean);
	}
	return String(value || '')
		.split(/[\n,]/)
		.map(group => group.trim())
		.filter(Boolean);
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
