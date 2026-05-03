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
