'use strict';

define('admin/plugins/reply-as-bot', ['alerts', 'autocomplete', 'iconSelect', 'translator'], function (alerts, autocomplete, iconSelect, translator) {
	const ACP = {};

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

		$('#save').on('click', function () {
			socket.emit('plugins.replyAsBot.saveSettings', {
				botUsername: form.find('[name="botUsername"]').val(),
				allowedGroups: form.find('[name="allowedGroups"]').val() || [],
				iconClass: form.find('[name="iconClass"]').val(),
			}, function (err) {
				if (err) {
					return alerts.error(err);
				}
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
