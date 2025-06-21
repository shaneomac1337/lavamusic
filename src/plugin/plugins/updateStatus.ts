import type { Lavamusic } from '../../structures/index';
import type { BotPlugin } from '../index';

const updateStatusPlugin: BotPlugin = {
	name: 'Update Status Plugin',
	version: '1.0.0',
	author: 'Appu',
	initialize: (client: Lavamusic) => {
		client.on('ready', () => {
			client.utils.updateStatus(client);
			// Update status every 2 minutes to keep it fresh (reduced frequency due to debouncing)
			setInterval(() => {
				client.utils.updateStatus(client);
			}, 120000);
		});
	},
};

export default updateStatusPlugin;

/**
 * Project: lavamusic
 * Author: Appu
 * Main Contributor: LucasB25
 * Company: Coders
 * Copyright (c) 2024. All rights reserved.
 * This code is the property of Coder and may not be reproduced or
 * modified without permission. For more information, contact us at
 * https://discord.gg/YQsGbTwPBx
 */
