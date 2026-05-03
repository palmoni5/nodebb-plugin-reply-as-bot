# nodebb-plugin-reply-as-bot

NodeBB plugin that allows authorized groups to reply as a configured bot user.

## Features

- Lets selected groups post replies as a configured bot account
- Adds a dedicated reply-as-bot button in topic replies
- Supports reusable saved text templates in the composer
- Includes an ACP settings page for bot user, icon, and allowed groups
- Includes English and Hebrew translations

## Installation

Install and activate the plugin, then restart NodeBB:

```bash
npm install nodebb-plugin-reply-as-bot
./nodebb activate nodebb-plugin-reply-as-bot
./nodebb restart
```

## Configuration

In the ACP plugin page, configure:

- the bot username
- the groups allowed to use the feature
- the icon shown on the reply button
