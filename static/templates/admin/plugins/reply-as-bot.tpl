<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<form role="form" class="reply-as-bot-settings mb-4">
				<div class="mb-3">
					<label class="form-label" for="botUsername">[[reply-as-bot:admin.bot-username]]</label>
					<input id="botUsername" class="form-control" type="text" name="botUsername" value="{botUsername}" autocomplete="off" placeholder="[[reply-as-bot:admin.bot-username-placeholder]]" />
					<p class="form-text">[[reply-as-bot:admin.bot-username-help]]</p>
				</div>

				<div class="mb-3">
					<label class="form-label">[[reply-as-bot:admin.reply-icon]]</label>
					<div class="d-flex gap-2 align-items-center">
						<button type="button" component="reply-as-bot/icon-picker" class="btn btn-light d-flex align-items-center justify-content-center" style="width: 42px; height: 42px;" title="[[reply-as-bot:admin.choose-icon]]">
							<i component="reply-as-bot/icon" value="{iconClass}" class="fa fa-2x {iconClass}"></i>
						</button>
						<input type="text" class="form-control" name="iconClass" value="{iconClass}" readonly />
					</div>
				</div>

				<div class="mb-3">
					<label class="form-label" for="allowedGroups">[[reply-as-bot:admin.allowed-groups]]</label>
					<select id="allowedGroups" class="form-select" name="allowedGroups" multiple size="10">
						{{{ each groups }}}
						<option value="{groups.name}"{{{ if groups.selected }}} selected{{{ end }}}>{groups.displayName}</option>
						{{{ end }}}
					</select>
					<p class="form-text">[[reply-as-bot:admin.allowed-groups-help]]</p>
				</div>

				<div class="card mb-3">
					<div class="card-header">
						[[reply-as-bot:admin.ai.title]]
					</div>
					<div class="card-body">
						<div class="form-check form-switch mb-3">
							<input id="aiEnabled" class="form-check-input" type="checkbox" name="aiEnabled"{{{ if aiEnabled }}} checked{{{ end }}}>
							<label class="form-check-label" for="aiEnabled">[[reply-as-bot:admin.ai.enable]]</label>
							<p class="form-text mb-0">[[reply-as-bot:admin.ai.enable-help]]</p>
						</div>

						<div component="reply-as-bot/ai-only-mode-row" class="form-check form-switch mb-3">
							<input id="aiOnlyMode" class="form-check-input" type="checkbox" name="aiOnlyMode"{{{ if aiOnlyMode }}} checked{{{ end }}}>
							<label class="form-check-label" for="aiOnlyMode">[[reply-as-bot:admin.ai.ai-only-mode]]</label>
							<p class="form-text mb-0">[[reply-as-bot:admin.ai.ai-only-mode-help]]</p>
						</div>

						<div class="mb-3">
							<label class="form-label" for="aiProvider">[[reply-as-bot:admin.ai.provider]]</label>
							<select id="aiProvider" class="form-select" name="aiProvider">
								{{{ each providers }}}
								<option value="{providers.value}"{{{ if providers.selected }}} selected{{{ end }}}>{providers.label}</option>
								{{{ end }}}
							</select>
						</div>

						<div class="mb-3">
							<label class="form-label" for="aiModel">[[reply-as-bot:admin.ai.model]]</label>
							<input id="aiModel" class="form-control" type="text" name="aiModel" value="{aiModel}" autocomplete="off" placeholder="[[reply-as-bot:admin.ai.model-placeholder]]" />
							<p class="form-text">[[reply-as-bot:admin.ai.model-help]]</p>
						</div>

						<div class="mb-2">
							<label class="form-label" for="aiApiKey">[[reply-as-bot:admin.ai.api-key]]</label>
							<input id="aiApiKey" class="form-control" type="password" name="aiApiKey" value="" autocomplete="new-password" placeholder="{{{ if aiKeyConfigured }}}[[reply-as-bot:admin.ai.api-key-set]]{{{ else }}}[[reply-as-bot:admin.ai.api-key-placeholder]]{{{ end }}}" />
							<p class="form-text">[[reply-as-bot:admin.ai.api-key-help]]</p>
						</div>
						{{{ if aiKeyConfigured }}}
						<button type="button" class="btn btn-sm btn-outline-danger mb-3" component="reply-as-bot/clear-key">
							<i class="fa fa-trash"></i> [[reply-as-bot:admin.ai.clear-key]]
						</button>
						{{{ end }}}

						<div class="mb-3">
							<div class="d-flex justify-content-between align-items-center">
								<label class="form-label mb-0" for="aiTemperature">[[reply-as-bot:admin.ai.temperature]]</label>
								<button type="button" class="btn btn-sm btn-link p-0" component="reply-as-bot/reset-temperature">[[reply-as-bot:admin.ai.reset-default]]</button>
							</div>
							<input id="aiTemperature" class="form-control" type="number" min="0" max="2" step="0.1" name="aiTemperature" value="{aiTemperature}" data-default="{aiTemperatureDefault}" placeholder="{aiTemperatureDefault}" />
							<p class="form-text">[[reply-as-bot:admin.ai.temperature-help]]</p>
						</div>

						<div class="mb-3">
							<div class="d-flex justify-content-between align-items-center">
								<label class="form-label mb-0" for="aiSystemPrompt">[[reply-as-bot:admin.ai.system-prompt]]</label>
								<button type="button" class="btn btn-sm btn-link p-0" component="reply-as-bot/reset-prompt">[[reply-as-bot:admin.ai.reset-default]]</button>
							</div>
							<textarea id="aiSystemPrompt" class="form-control font-monospace" name="aiSystemPrompt" rows="14" data-default="{aiSystemPromptDefault}">{{{ if aiSystemPrompt }}}{aiSystemPrompt}{{{ else }}}{aiSystemPromptDefault}{{{ end }}}</textarea>
							<p class="form-text">[[reply-as-bot:admin.ai.system-prompt-help]]</p>
						</div>
					</div>
				</div>
			</form>

			<div class="card">
				<div class="card-header">
					[[reply-as-bot:templates.title]]
				</div>
				<div class="card-body">
					<div component="reply-as-bot/admin/templates" class="d-flex flex-column gap-2"></div>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
