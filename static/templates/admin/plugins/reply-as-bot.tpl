<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<form role="form" class="reply-as-bot-settings mb-4">
				<div class="mb-3">
					<label class="form-label" for="botUsername">שם משתמש הבוט</label>
					<input id="botUsername" class="form-control" type="text" name="botUsername" value="{botUsername}" autocomplete="off" placeholder="התחל להקליד ובחר משתמש" />
					<p class="form-text">יש לבחור משתמש קיים. תגובות בשם הבוט יישמרו כאילו נכתבו על ידו.</p>
				</div>

				<div class="mb-3">
					<label class="form-label">אייקון כפתור התגובה</label>
					<div class="d-flex gap-2 align-items-center">
						<button type="button" component="reply-as-bot/icon-picker" class="btn btn-light d-flex align-items-center justify-content-center" style="width: 42px; height: 42px;" title="בחירת אייקון">
							<i component="reply-as-bot/icon" value="{iconClass}" class="fa fa-2x {iconClass}"></i>
						</button>
						<input type="text" class="form-control" name="iconClass" value="{iconClass}" readonly />
					</div>
				</div>

				<div class="mb-3">
					<label class="form-label" for="allowedGroups">קבוצות מורשות</label>
					<select id="allowedGroups" class="form-select" name="allowedGroups" multiple size="10">
						{{{ each groups }}}
						<option value="{groups.name}"{{{ if groups.selected }}} selected{{{ end }}}>{groups.displayName}</option>
						{{{ end }}}
					</select>
					<p class="form-text">רק חברים בקבוצות המסומנות יראו את כפתור התגובה בשם הבוט.</p>
				</div>
			</form>

			<div class="card">
				<div class="card-header">
					תבניות קבועות
				</div>
				<div class="card-body">
					<div component="reply-as-bot/admin/templates" class="d-flex flex-column gap-2"></div>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
