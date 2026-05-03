'use strict';

require(['hooks', 'alerts', 'bootbox', 'translator'], function (hooks, alerts, bootbox, translator) {
	const state = {
		loaded: false,
		canUse: false,
		botUsername: '',
		iconClass: 'fa-user-secret',
		templates: [],
		pending: null,
	};

	hooks.on('action:ajaxify.end', function () {
		if (ajaxify.data && ajaxify.data.template && ajaxify.data.template.name === 'topic') {
			ensureState(addReplyButtons);
		}
	});

	hooks.on('action:topic.loaded', function () {
		ensureState(addReplyButtons);
	});

	hooks.on('action:posts.loaded', function () {
		if (ajaxify.data && ajaxify.data.template && ajaxify.data.template.name === 'topic') {
			setTimeout(function () {
				ensureState(addReplyButtons);
			}, 0);
		}
	});

	$(document).ready(function () {
		if (ajaxify.data && ajaxify.data.template && ajaxify.data.template.name === 'topic') {
			ensureState(addReplyButtons);
		}
	});

	$(document).on('click', '[component="reply-as-bot/reply"]', async function (event) {
		event.preventDefault();
		const button = $(this);
		const post = button.parents('[component="post"]');
		const selectedNode = await getSelectedNode();
		const username = await getUserSlug(post);
		const toPid = button.attr('data-pid');
		const isQuoteToPid = !selectedNode.pid || toPid === selectedNode.pid;

		state.pending = {
			tid: ajaxify.data.tid,
			toPid: toPid,
		};

		if (selectedNode.text && isQuoteToPid) {
			hooks.fire('action:composer.addQuote', {
				tid: ajaxify.data.tid,
				pid: toPid,
				title: ajaxify.data.titleRaw,
				username: username || selectedNode.username,
				body: selectedNode.text,
				selectedPid: selectedNode.pid,
			});
			return;
		}

		require(['composer'], function (composer) {
			composer.newReply({
				tid: ajaxify.data.tid,
				toPid: toPid,
				title: ajaxify.data.titleRaw,
				body: username ? `${username} ` : '',
			});
		});
	});

	hooks.on('action:composer.enhanced', async function ({ postContainer, postData }) {
		if (!state.pending || !postData || postData.action !== 'posts.reply') {
			return;
		}

		if (String(postData.tid) !== String(state.pending.tid) || String(postData.toPid) !== String(state.pending.toPid)) {
			return;
		}

		postData.replyAsBot = true;
		state.pending = null;
		postContainer.addClass('reply-as-bot-composer');
		addComposerControls(postContainer);
	});

	hooks.on('filter:composer.submit', function (hookData) {
		if (!hookData || hookData.action !== 'posts.reply' || !hookData.postData || !hookData.postData.replyAsBot) {
			return hookData;
		}

		hookData.composerData.replyAsBot = true;
		return hookData;
	});

	function ensureState(callback) {
		if (state.loaded) {
			return callback();
		}

		socket.emit('plugins.replyAsBot.getState', function (err, data) {
			if (err) {
				return alerts.error(err);
			}
			state.loaded = true;
			state.canUse = !!data.canUse;
			state.botUsername = data.botUsername || '';
			state.iconClass = data.iconClass || 'fa-user-secret';
			state.templates = data.templates || [];
			callback();
		});
	}

	function addReplyButtons() {
		if (!state.canUse || !state.botUsername) {
			return;
		}

		$('[component="post"]').each(function () {
			const post = $(this);
			if (post.find('[component="reply-as-bot/reply"]').length) {
				return;
			}

			const reply = post.find('[component="post/reply"]').first();
			if (!reply.length || reply.hasClass('hidden')) {
				return;
			}

			translator.translate(`[[reply-as-bot:client.reply-title, ${escapeHtml(state.botUsername)}]]`, function (title) {
				const botReply = $(`
					<a component="reply-as-bot/reply" href="#" class="btn btn-ghost btn-sm" title="${escapeAttr(title)}">
						<i class="fa fa-fw ${escapeAttr(state.iconClass)} text-warning"></i>
					</a>
				`);
				botReply.attr('data-pid', post.attr('data-pid'));
				botReply.attr('data-uid', post.attr('data-uid'));
				botReply.attr('data-userslug', post.attr('data-userslug'));
				reply.after(botReply);
			});
		});
	}

	function addComposerControls(postContainer) {
		if (postContainer.find('[component="reply-as-bot/banner"]').length) {
			return;
		}

		translator.translate(
			`<div component="reply-as-bot/banner" class="alert alert-warning py-2 mx-2 mb-1"><strong>[[reply-as-bot:client.banner, ${escapeHtml(state.botUsername)}]]</strong></div>`,
			function (translatedBanner) {
				postContainer.find('.composer-container').prepend($(translatedBanner));
			}
		);

		translator.translate(`
			<li component="reply-as-bot/templates" class="dropdown bottom-sheet" title="[[reply-as-bot:templates.title]]">
				<button type="button" class="btn btn-sm btn-link text-reset dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="[[reply-as-bot:templates.title]]">
					<i class="fa fa-file-text-o"></i>
					<span>[[reply-as-bot:templates.title]]</span>
				</button>
				<ul class="dropdown-menu p-1" role="menu"></ul>
			</li>
		`, function (translatedMenu) {
			postContainer.find('.formatting-bar .formatting-group').append($(translatedMenu));
			renderTemplateMenu(postContainer);
		});
	}

	function renderTemplateMenu(postContainer) {
		const menu = postContainer.find('[component="reply-as-bot/templates"] .dropdown-menu');
		const templates = state.templates || [];
		const items = templates.map(template => `
			<li>
				<button type="button" class="dropdown-item d-flex align-items-center justify-content-between gap-2" data-template-id="${escapeAttr(template.id)}">
					<span>${escapeHtml(template.title)}</span>
					<span class="text-muted">
						<i class="fa fa-pencil" data-template-edit="${escapeAttr(template.id)}"></i>
						<i class="fa fa-trash ms-2" data-template-delete="${escapeAttr(template.id)}"></i>
					</span>
				</button>
			</li>
		`).join('');

		translator.translate(`
			${items || '<li><span class="dropdown-item-text text-muted">[[reply-as-bot:templates.none]]</span></li>'}
			<li><hr class="dropdown-divider"></li>
			<li><button type="button" class="dropdown-item" data-template-add="1"><i class="fa fa-plus"></i> [[reply-as-bot:templates.add]]</button></li>
		`, function (translated) {
			menu.html(translated);
		});

		menu.off('click.replyAsBot').on('click.replyAsBot', '[data-template-id]', function (event) {
			const target = $(event.target);
			if (target.is('[data-template-edit], [data-template-delete]')) {
				return;
			}
			const template = findTemplate($(this).attr('data-template-id'));
			if (template) {
				insertAtCursor(postContainer.find('textarea.write')[0], template.text);
			}
		});

		menu.on('click.replyAsBot', '[data-template-add]', function (event) {
			event.preventDefault();
			openTemplateDialog(postContainer);
		});

		menu.on('click.replyAsBot', '[data-template-edit]', function (event) {
			event.preventDefault();
			event.stopPropagation();
			openTemplateDialog(postContainer, findTemplate($(this).attr('data-template-edit')));
		});

		menu.on('click.replyAsBot', '[data-template-delete]', function (event) {
			event.preventDefault();
			event.stopPropagation();
			deleteTemplate(postContainer, $(this).attr('data-template-delete'));
		});
	}

	function openTemplateDialog(postContainer, template) {
		template = template || {};
		bootbox.dialog({
			title: template.id ? '[[reply-as-bot:templates.edit]]' : '[[reply-as-bot:templates.add]]',
			message: `
				<div class="mb-3">
					<label class="form-label">[[reply-as-bot:templates.template-title]]</label>
					<input class="form-control" component="reply-as-bot/template-title" value="${escapeAttr(template.title || '')}">
				</div>
				<div class="mb-3">
					<label class="form-label">[[reply-as-bot:templates.template-text]]</label>
					<textarea class="form-control" rows="6" component="reply-as-bot/template-text">${escapeHtml(template.text || '')}</textarea>
				</div>
			`,
			buttons: {
				cancel: {
					label: '[[modules:bootbox.cancel]]',
				},
				save: {
					label: '[[global:save]]',
					className: 'btn-primary',
					callback: function () {
						const modal = $('.bootbox');
						socket.emit('plugins.replyAsBot.saveTemplate', {
							id: template.id,
							title: modal.find('[component="reply-as-bot/template-title"]').val(),
							text: modal.find('[component="reply-as-bot/template-text"]').val(),
						}, function (err, saved) {
							if (err) {
								return alerts.error(err);
							}
							state.templates = state.templates.filter(item => String(item.id) !== String(saved.id));
							state.templates.unshift(saved);
							renderTemplateMenu(postContainer);
							alerts.success('[[global:saved]]');
						});
					},
				},
			},
		});
	}

	function deleteTemplate(postContainer, id) {
		bootbox.confirm('[[reply-as-bot:templates.delete-confirm]]', function (ok) {
			if (!ok) {
				return;
			}
			socket.emit('plugins.replyAsBot.deleteTemplate', { id }, function (err) {
				if (err) {
					return alerts.error(err);
				}
				state.templates = state.templates.filter(template => String(template.id) !== String(id));
				renderTemplateMenu(postContainer);
			});
		});
	}

	function findTemplate(id) {
		return state.templates.find(template => String(template.id) === String(id));
	}

	function insertAtCursor(textarea, text) {
		if (!textarea) {
			return;
		}
		const start = textarea.selectionStart || 0;
		const end = textarea.selectionEnd || 0;
		const current = textarea.value;
		textarea.value = current.slice(0, start) + text + current.slice(end);
		textarea.selectionStart = textarea.selectionEnd = start + text.length;
		$(textarea).trigger('change').trigger('input').focus();
	}

	async function getSelectedNode() {
		let selectedText = '';
		let selectedPid;
		let username = '';
		const selection = window.getSelection ? window.getSelection() : document.selection.createRange();
		const postContents = $('[component="post"] [component="post/content"]');
		let content;

		postContents.each(function (index, el) {
			if (selection && selection.containsNode && el && selection.containsNode(el, true)) {
				content = el;
			}
		});

		if (content && selection) {
			selectedText = selection.toString();
			const post = $(content).parents('[component="post"]');
			selectedPid = post.attr('data-pid');
			username = await getUserSlug(post);
		}

		return { text: selectedText, pid: selectedPid, username: username };
	}

	function getUserSlug(post) {
		return new Promise((resolve) => {
			if (!post || !post.length) {
				resolve('');
				return;
			}

			require(['slugify'], function (slugify) {
				let slug = slugify(post.attr('data-username'), true);
				if (!slug) {
					if (post.attr('data-uid') !== '0') {
						slug = '[[global:former-user]]';
					} else {
						slug = '[[global:guest]]';
					}
				}
				if (slug && slug !== '[[global:former-user]]' && slug !== '[[global:guest]]') {
					slug = `@${slug}`;
				}
				resolve(slug);
			});
		});
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

	function escapeAttr(text) {
		return escapeHtml(text).replace(/`/g, '&#96;');
	}
});
