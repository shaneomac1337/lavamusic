import {
	ActionRowBuilder,
	ActivityType,
	ButtonBuilder,
	ButtonStyle,
	CommandInteraction,
	Message,
	MessageFlags,
	type TextChannel,
} from 'discord.js';
import type { Context, Lavamusic } from '../structures/index';

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class Utils {
	public static formatTime(ms: number): string {
		const minuteMs = 60 * 1000;
		const hourMs = 60 * minuteMs;
		const dayMs = 24 * hourMs;
		if (ms < minuteMs) return `${ms / 1000}s`;
		if (ms < hourMs) return `${Math.floor(ms / minuteMs)}m ${Math.floor((ms % minuteMs) / 1000)}s`;
		if (ms < dayMs) return `${Math.floor(ms / hourMs)}h ${Math.floor((ms % hourMs) / minuteMs)}m`;
		return `${Math.floor(ms / dayMs)}d ${Math.floor((ms % dayMs) / hourMs)}h`;
	}

	private static statusUpdateTimeout: NodeJS.Timeout | null = null;
	private static lastStatusUpdate: string = '';

	public static updateStatus(client: Lavamusic, guildId?: string): void {
		// Debounce status updates to prevent rapid changes
		if (this.statusUpdateTimeout) {
			clearTimeout(this.statusUpdateTimeout);
		}

		this.statusUpdateTimeout = setTimeout(() => {
			this.performStatusUpdate(client, guildId);
		}, 1000); // Wait 1 second before updating to allow multiple events to settle
	}

	private static performStatusUpdate(client: Lavamusic, guildId?: string): void {
		const { user } = client;
		if (!user) return;

		// Get all active players with current tracks (more robust filtering)
		const activePlayers = Array.from(client.manager.players.values()).filter(p =>
			p.connected && p.queue?.current && p.playing && !p.paused
		);
		const totalPlayers = activePlayers.length;

		let activityName: string;
		let activityType: ActivityType;

		if (totalPlayers > 0) {
			if (totalPlayers === 1) {
				// Single server playing - show current track with guild name
				const player = activePlayers[0];
				const track = player.queue?.current;
				if (track) {
					// Get guild name with fallback
					const guild = client.guilds.cache.get(player.guildId);
					const guildName = guild?.name || `Server ${player.guildId.slice(-4)}`;
					
					// Smart truncation to fit Discord's ~128 character limit
					// Format: "🎵 {title} in {guildName}" (🎵 + spaces = ~7 chars, " in " = 4 chars)
					const maxLength = 120; // Leave some buffer
					const prefixLength = 7; // "🎵 " + " in "
					const availableLength = maxLength - prefixLength;
					
					let title = track.info.title;
					let displayGuildName = guildName;
					
					// If combined length exceeds limit, truncate intelligently
					if (title.length + displayGuildName.length > availableLength) {
						const guildMaxLength = Math.min(25, displayGuildName.length); // Limit guild name to 25 chars
						displayGuildName = displayGuildName.length > guildMaxLength 
							? displayGuildName.substring(0, guildMaxLength - 3) + "..." 
							: displayGuildName;
						
						const titleMaxLength = availableLength - displayGuildName.length;
						if (title.length > titleMaxLength) {
							title = title.substring(0, titleMaxLength - 3) + "...";
						}
					}
					
					activityName = `🎵 ${title} in ${displayGuildName}`;
					activityType = ActivityType.Listening;
				} else {
					activityName = client.env.BOT_ACTIVITY;
					activityType = client.env.BOT_ACTIVITY_TYPE;
				}
			} else {
				// Multiple servers playing - show count
				activityName = `🎶 Music in ${totalPlayers} servers`;
				activityType = ActivityType.Listening;
			}
		} else {
			// No music playing
			activityName = client.env.BOT_ACTIVITY;
			activityType = client.env.BOT_ACTIVITY_TYPE;
		}

		// Only update if the status actually changed
		if (this.lastStatusUpdate !== activityName) {
			this.lastStatusUpdate = activityName;

			user.setPresence({
				activities: [
					{
						name: activityName,
						type: activityType,
					},
				],
				status: client.env.BOT_STATUS as any,
			});

			console.log(`🎵 Bot status updated: "${activityName}" (${totalPlayers} active players)`);
		}
	}

	public static chunk(array: any[], size: number) {
		const chunked_arr: any[][] = [];
		for (let index = 0; index < array.length; index += size) {
			chunked_arr.push(array.slice(index, size + index));
		}
		return chunked_arr;
	}

	public static formatBytes(bytes: number, decimals = 2): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
	}

	public static formatNumber(number: number): string {
		return number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
	}

	public static parseTime(string: string): number {
		const time = string.match(/(\d+[dhms])/g);
		if (!time) return 0;
		let ms = 0;
		for (const t of time) {
			const unit = t[t.length - 1];
			const amount = Number(t.slice(0, -1));
			if (unit === 'd') ms += amount * 24 * 60 * 60 * 1000;
			else if (unit === 'h') ms += amount * 60 * 60 * 1000;
			else if (unit === 'm') ms += amount * 60 * 1000;
			else if (unit === 's') ms += amount * 1000;
		}
		return ms;
	}

	public static progressBar(current: number, total: number, size = 20): string {
		const percent = Math.round((current / total) * 100);
		const filledSize = Math.round((size * current) / total);
		const filledBar = '▓'.repeat(filledSize);
		const emptyBar = '░'.repeat(size - filledSize);
		return `${filledBar}${emptyBar} ${percent}%`;
	}

	public static async paginate(client: Lavamusic, ctx: Context, embed: any[]): Promise<void> {
		if (embed.length < 2) {
			if (ctx.isInteraction) {
				ctx.deferred ? ctx.interaction?.followUp({ embeds: embed }) : ctx.interaction?.reply({ embeds: embed });
				return;
			}

			(ctx.channel as TextChannel).send({ embeds: embed });
			return;
		}

		let page = 0;
		const getButton = (page: number): any => {
			const firstEmbed = page === 0;
			const lastEmbed = page === embed.length - 1;
			const pageEmbed = embed[page];
			const first = new ButtonBuilder()
				.setCustomId('first')
				.setEmoji(client.emoji.page.first)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(firstEmbed);
			const back = new ButtonBuilder()
				.setCustomId('back')
				.setEmoji(client.emoji.page.back)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(firstEmbed);
			const next = new ButtonBuilder()
				.setCustomId('next')
				.setEmoji(client.emoji.page.next)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(lastEmbed);
			const last = new ButtonBuilder()
				.setCustomId('last')
				.setEmoji(client.emoji.page.last)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(lastEmbed);
			const stop = new ButtonBuilder()
				.setCustomId('stop')
				.setEmoji(client.emoji.page.cancel)
				.setStyle(ButtonStyle.Danger);
			const row = new ActionRowBuilder().addComponents(first, back, stop, next, last);
			return { embeds: [pageEmbed], components: [row] };
		};

		const msgOptions = getButton(0);
		let msg: Message;
		if (ctx.isInteraction) {
			if (ctx.deferred) {
				msg = await ctx.interaction!.followUp({
					...msgOptions,
					withResponse: true,
				});
			} else {
				msg = (await ctx.interaction!.reply({
					...msgOptions,
					withResponse: true,
				})) as unknown as Message;
			}
		} else {
			msg = await (ctx.channel as TextChannel).send({
				...msgOptions,
				withResponse: true,
			});
		}

		const author = ctx instanceof CommandInteraction ? ctx.user : ctx.author;

		const filter = (int: any): any => int.user.id === author?.id;
		const collector = msg.createMessageComponentCollector({
			filter,
			time: 60000,
		});

		collector.on('collect', async interaction => {
			if (interaction.user.id === author?.id) {
				await interaction.deferUpdate();
				if (interaction.customId === 'first' && page !== 0) {
					page = 0;
				} else if (interaction.customId === 'back' && page !== 0) {
					page--;
				} else if (interaction.customId === 'stop') {
					collector.stop();
				} else if (interaction.customId === 'next' && page !== embed.length - 1) {
					page++;
				} else if (interaction.customId === 'last' && page !== embed.length - 1) {
					page = embed.length - 1;
				}
				await interaction.editReply(getButton(page));
			} else {
				await interaction.reply({
					content: ctx.locale('buttons.errors.not_author'),
					flags: MessageFlags.Ephemeral,
				});
			}
		});

		collector.on('end', async () => {
			await msg.edit({ embeds: [embed[page]], components: [] });
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
