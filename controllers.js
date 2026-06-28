'use strict';

const meta = require.main.require('./src/meta');
const groups = require.main.require('./src/groups');

const ai = require('./ai');
const library = require('./library');

const Controllers = module.exports;

Controllers.renderAdminPage = async function (req, res) {
	const [settings, groupData] = await Promise.all([
		meta.settings.get('reply-as-bot'),
		groups.getNonPrivilegeGroups('groups:createtime', 0, -1),
	]);
	const selected = library.parseGroups(settings.allowedGroups);
	const aiProvider = library.normalizeProvider(settings.aiProvider);
	const aiSystemPrompt = String(settings.aiSystemPrompt || '');
	const aiTemperatureRaw = settings.aiTemperature;
	const aiTemperature = aiTemperatureRaw === '' || aiTemperatureRaw === undefined || aiTemperatureRaw === null ? '' : String(aiTemperatureRaw);

	res.render('admin/plugins/reply-as-bot', {
		title: '[[reply-as-bot:admin.title]]',
		botUsername: settings.botUsername || '',
		iconClass: library.normalizeIconClass(settings.iconClass),
		groups: groupData.map(group => ({
			name: group.name,
			displayName: group.displayName,
			selected: selected.includes(group.name) || selected.includes(group.displayName),
		})),
		aiEnabled: settings.aiEnabled === true || settings.aiEnabled === 'true' || settings.aiEnabled === 'on',
		aiOnlyMode: settings.aiOnlyMode === true || settings.aiOnlyMode === 'true' || settings.aiOnlyMode === 'on',
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
