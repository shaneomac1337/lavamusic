import type { TextChannel } from 'discord.js';
import type { Player, Track, TrackStartEvent } from 'lavalink-client';
import { Event, type Lavamusic } from '../../structures/index';
import { updateSetup } from '../../utils/SetupSystem';

export default class TrackEnd extends Event {
	constructor(client: Lavamusic, file: string) {
		super(client, file, {
			name: 'trackEnd',
		});
	}

	public async run(player: Player, _track: Track | null, _payload: TrackStartEvent): Promise<void> {
		const guild = this.client.guilds.cache.get(player.guildId);
		if (!guild) return;

		const locale = await this.client.db.getLanguage(player.guildId);
		await updateSetup(this.client, guild, locale);

		// Update bot status when track ends
		this.client.utils.updateStatus(this.client);

		// Stop radio detection when track ends (unless another radio track starts)
		// Note: This will be restarted in TrackStart if the next track is also a radio stream
		console.log(`🔚 Track ended for guild ${player.guildId}, stopping radio detection`);
		this.client.radioDetection.stopRadioDetection(player.guildId);

		const messageId = player.get<string | undefined>('messageId');
		if (!messageId) return;

		const channel = guild.channels.cache.get(player.textChannelId!) as TextChannel;
		if (!channel) return;

		const message = await channel.messages.fetch(messageId).catch(() => {
			null;
		});
		if (!message) return;

		message.delete().catch(() => {
			null;
		});
	}
}

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
