'use strict';

const meta = require.main.require('./src/meta');
const groups = require.main.require('./src/groups');

const ai = require('./ai');

const Controllers = module.exports;

Controllers.renderAdminPage = async function (req, res) {
	const [settings, groupData] = await Promise.all([
		meta.settings.get('reply-as-bot'),
		groups.getNonPrivilegeGroups('groups:createtime', 0, -1),
	]);
	const selected = parseGroups(settings.allowedGroups);
	const aiProvider = normalizeProvider(settings.aiProvider);
	const aiSystemPrompt = String(settings.aiSystemPrompt || '');
	const aiTemperatureRaw = settings.aiTemperature;
	const aiTemperature = aiTemperatureRaw === '' || aiTemperatureRaw === undefined || aiTemperatureRaw === null ? '' : String(aiTemperatureRaw);

	res.render('admin/plugins/reply-as-bot', {
		title: '[[reply-as-bot:admin.title]]',
		botUsername: settings.botUsername || '',
		iconClass: normalizeIconClass(settings.iconClass),
		groups: groupData.map(group => ({
			name: group.name,
			displayName: group.displayName,
			selected: selected.includes(group.name) || selected.includes(group.displayName),
		})),
		aiEnabled: settings.aiEnabled === true || settings.aiEnabled === 'true' || settings.aiEnabled === 'on',
		aiProvider,
		aiModel: String(settings.aiModel || ''),
		aiKeyConfigured: !!settings.aiApiKey,
		aiSystemPrompt,
		aiSystemPromptDefault: ai.DEFAULT_SYSTEM_PROMPT,
		aiTemperature,
		aiTemperatureDefault: String(ai.DEFAULT_TEMPERATURE),
		providers: [
			{ value: 'openai', label: 'OpenAI', selected: aiProvider === 'openai' },
			{ value: 'anthropic', label: 'Anthropic', selected: aiProvider === 'anthropic' },
			{ value: 'gemini', label: 'Google Gemini', selected: aiProvider === 'gemini' },
		],
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
		return 'fa-robot';
	}
	return iconClass;
}

function normalizeProvider(provider) {
	provider = String(provider || '').trim().toLowerCase();
	return ['openai', 'anthropic', 'gemini'].includes(provider) ? provider : 'openai';
}
