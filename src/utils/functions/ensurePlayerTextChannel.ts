import type { Player } from 'lavalink-client';
import type Lavamusic from '../../structures/Lavamusic';

/**
 * Ensures that a player's text channel is set to the guild's configured text channel.
 * This is called whenever we get an existing player to make sure it uses the correct channel
 * for notifications, even if the configuration was changed after the player was created.
 * 
 * @param client - The Lavamusic client
 * @param player - The player to update
 * @param guildId - The guild ID
 */
export async function ensurePlayerTextChannel(
	client: Lavamusic,
	player: Player | undefined,
	guildId: string
): Promise<void> {
	if (!player) return;

	// Get the configured text channel for this guild
	const configuredTextChannelId = await client.db.getTextChannel(guildId);
	
	// If there's a configured channel and it's different from the current one, update it
	if (configuredTextChannelId && player.textChannelId !== configuredTextChannelId) {
		player.textChannelId = configuredTextChannelId;
		console.log(`[TextChannel] Updated player text channel for guild ${guildId} to ${configuredTextChannelId}`);
	}
}

/**
 * Gets a player and ensures it uses the configured text channel.
 * Use this instead of client.manager.getPlayer() to automatically apply text channel settings.
 * 
 * @param client - The Lavamusic client
 * @param guildId - The guild ID
 * @returns The player with updated text channel, or undefined if no player exists
 */
export async function getPlayerWithTextChannel(
	client: Lavamusic,
	guildId: string
): Promise<Player | undefined> {
	const player = client.manager.getPlayer(guildId);
	await ensurePlayerTextChannel(client, player, guildId);
	return player;
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
