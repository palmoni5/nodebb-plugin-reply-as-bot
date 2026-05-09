'use strict';

define('admin/plugins/reply-as-bot', ['alerts', 'autocomplete', 'iconSelect', 'translator'], function (alerts, autocomplete, iconSelect, translator) {
	const ACP = {};

	let clearKeyRequested = false;

	ACP.init = function () {
		const form = $('.reply-as-bot-settings');
		loadTemplates();
		autocomplete.user($('#botUsername'), function (event, selected) {
			$('#botUsername').val(selected.item.user.username);
		});

		form.find('[component="reply-as-bot/icon-picker"]').on('click', function () {
			const icon = form.find('[component="reply-as-bot/icon"]');
			iconSelect.init(icon, function () {
				let iconClass = icon.attr('value');
				if (iconClass === 'fa-nbb-none') {
					iconClass = 'fa-robot';
					icon.attr('value', iconClass).attr('class', `fa fa-2x ${iconClass}`);
				}
				form.find('[name="iconClass"]').val(iconClass);
			});
		});

		form.on('click', '[component="reply-as-bot/clear-key"]', function () {
			clearKeyRequested = true;
			$('#aiApiKey').val('').attr('placeholder', '[[reply-as-bot:admin.ai.api-key-placeholder]]');
			translator.translate('[[reply-as-bot:admin.ai.api-key-cleared]]', function (translated) {
				alerts.alert({ type: 'info', message: translated, timeout: 3000 });
			});
		});

		form.on('click', '[component="reply-as-bot/reset-prompt"]', function () {
			const textarea = $('#aiSystemPrompt');
			textarea.val(textarea.attr('data-default') || '');
		});

		form.on('click', '[component="reply-as-bot/reset-temperature"]', function () {
			const input = $('#aiTemperature');
			input.val(input.attr('data-default') || '');
		});

		$('#save').on('click', function () {
			const payload = {
				botUsername: form.find('[name="botUsername"]').val(),
				allowedGroups: form.find('[name="allowedGroups"]').val() || [],
				iconClass: form.find('[name="iconClass"]').val(),
				aiEnabled: form.find('[name="aiEnabled"]').is(':checked'),
				aiProvider: form.find('[name="aiProvider"]').val(),
				aiModel: form.find('[name="aiModel"]').val(),
				aiApiKey: clearKeyRequested ? '__CLEAR__' : (form.find('[name="aiApiKey"]').val() || ''),
				aiSystemPrompt: form.find('[name="aiSystemPrompt"]').val() || '',
				aiTemperature: form.find('[name="aiTemperature"]').val() || '',
			};

			socket.emit('plugins.replyAsBot.saveSettings', payload, function (err) {
				if (err) {
					return alerts.error(err);
				}
				clearKeyRequested = false;
				$('#aiApiKey').val('');
				alerts.success('[[global:saved]]');
			});
		});
	};

	function loadTemplates() {
		socket.emit('plugins.replyAsBot.getState', function (err, state) {
			if (err) {
				return alerts.error(err);
			}
			const container = $('[component="reply-as-bot/admin/templates"]');
			const templates = state.templates || [];
			translator.translate(
				templates.length ? templates.map(renderTemplate).join('') : '<p class="text-muted mb-0">[[reply-as-bot:templates.none-yet]]</p>',
				function (translated) {
					container.html(translated);
				}
			);
		});
	}

	function renderTemplate(template) {
		return `
			<div class="border rounded-1 p-2">
				<div class="fw-semibold">${escapeHtml(template.title)}</div>
				<div class="text-muted small text-break">${escapeHtml(template.text)}</div>
			</div>
		`;
	}

	function escapeHtml(text) {
		return String(text || '').replace(/[&<>"']/g, function (char) {
			return ({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			})[char];
		});
	}

	return ACP;
});
