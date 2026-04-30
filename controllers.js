'use strict';

const meta = require.main.require('./src/meta');
const groups = require.main.require('./src/groups');

const Controllers = module.exports;

Controllers.renderAdminPage = async function (req, res) {
	const [settings, groupData] = await Promise.all([
		meta.settings.get('reply-as-bot'),
		groups.getNonPrivilegeGroups('groups:createtime', 0, -1),
	]);
	const selected = parseGroups(settings.allowedGroups);

	res.render('admin/plugins/reply-as-bot', {
		title: 'תגובה בשם בוט',
		botUsername: settings.botUsername || '',
		iconClass: normalizeIconClass(settings.iconClass),
		groups: groupData.map(group => ({
			name: group.name,
			displayName: group.displayName,
			selected: selected.includes(group.name) || selected.includes(group.displayName),
		})),
	});
};

function parseGroups(value) {
	if (Array.isArray(value)) {
		return value.map(String);
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
		return 'fa-user-secret';
	}
	return iconClass;
}
