import { Command, type Context, type Lavamusic } from '../../structures/index';

export default class Help extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'help',
			description: {
				content: 'cmd.help.description',
				examples: ['help'],
				usage: 'help',
			},
			category: 'info',
			aliases: ['h'],
			cooldown: 3,
			args: false,
			vote: false,
			player: {
				voice: false,
				dj: false,
				active: false,
				djPerm: null,
			},
			permissions: {
				dev: false,
				client: ['SendMessages', 'ReadMessageHistory', 'ViewChannel', 'EmbedLinks'],
				user: [],
			},
			slashCommand: true,
			options: [
				{
					name: 'command',
					description: 'cmd.help.options.command',
					type: 3,
					required: false,
				},
			],
		});
	}

	public async run(client: Lavamusic, ctx: Context, args: string[]): Promise<any> {
		const embed = this.client.embed();
		const guild = await client.db.get(ctx.guild!.id);
		const commands = this.client.commands.filter(cmd => cmd.category !== 'dev');
		const categories = [...new Set(commands.map(cmd => cmd.category))];

		if (args[0]) {
			const command = this.client.commands.get(args[0].toLowerCase());
			if (!command) {
				return await ctx.sendMessage({
					embeds: [
						embed.setColor(this.client.color.red).setDescription(
							ctx.locale('cmd.help.not_found', {
								cmdName: args[0],
							}),
						),
					],
				});
			}
			const helpEmbed = embed
				.setColor(client.color.main)
				.setTitle(`${ctx.locale('cmd.help.title')} - ${command.name}`)
				.setDescription(
					ctx.locale('cmd.help.help_cmd', {
						description: ctx.locale(command.description.content),
						usage: `${guild?.prefix}${command.description.usage}`,
						examples: command.description.examples.map((example: string) => `${guild.prefix}${example}`).join(', '),
						aliases: command.aliases.map((alias: string) => `\`${alias}\``).join(', '),
						category: command.category,
						cooldown: command.cooldown,
						premUser:
							command.permissions.user.length > 0
								? command.permissions.user.map((perm: string) => `\`${perm}\``).join(', ')
								: 'None',
						premBot: command.permissions.client.map((perm: string) => `\`${perm}\``).join(', '),
						dev: command.permissions.dev ? 'Yes' : 'No',
						slash: command.slashCommand ? 'Yes' : 'No',
						args: command.args ? 'Yes' : 'No',
						player: command.player.active ? 'Yes' : 'No',
						dj: command.player.dj ? 'Yes' : 'No',
						djPerm: command.player.djPerm ? command.player.djPerm : 'None',
						voice: command.player.voice ? 'Yes' : 'No',
					}),
				);
			return await ctx.sendMessage({ embeds: [helpEmbed] });
		}

		// Define category descriptions and emojis for better organization
		const categoryInfo: Record<string, { emoji: string; description: string; priority: number }> = {
			music: {
				emoji: '🎵',
				description: 'Music playback, queue management, and audio controls',
				priority: 1
			},
			filters: {
				emoji: '🎛️',
				description: 'Audio filters and effects (bassboost, nightcore, etc.)',
				priority: 2
			},
			playlist: {
				emoji: '📋',
				description: 'Create and manage custom playlists',
				priority: 3
			},
			config: {
				emoji: '⚙️',
				description: 'Server configuration and bot settings',
				priority: 4
			},
			general: {
				emoji: '🔧',
				description: 'General utility commands',
				priority: 5
			},
			info: {
				emoji: 'ℹ️',
				description: 'Bot information and help commands',
				priority: 6
			}
		};

		// Sort categories by priority
		const sortedCategories = categories.sort((a, b) => {
			const priorityA = categoryInfo[a]?.priority || 999;
			const priorityB = categoryInfo[b]?.priority || 999;
			return priorityA - priorityB;
		});

		const fields = sortedCategories.map(category => {
			const info = categoryInfo[category] || { emoji: '📁', description: 'Other commands', priority: 999 };
			const categoryCommands = commands.filter(cmd => cmd.category === category);

			return {
				name: `${info.emoji} ${category.charAt(0).toUpperCase() + category.slice(1)} (${categoryCommands.length})`,
				value: `${info.description}\n\`${categoryCommands.map(cmd => cmd.name).join('`, `')}\``,
				inline: false,
			};
		});

		// Add special features section
		const specialFeatures = [
			'📻 **Radio Stations** - Stream live Czech and Slovak radio with automatic song detection',
			'🗣️ **Text-to-Speech** - Convert text to speech with the `say` command',
			'🌐 **Web Dashboard** - Control the bot through a web interface',
			'🎯 **Auto-Join** - Bot automatically joins your voice channel when needed',
			'🔄 **Real-time Updates** - Live song detection and queue updates'
		];

		const helpEmbed = embed
			.setColor(client.color.main)
			.setTitle(`${ctx.locale('cmd.help.title')} 🎵`)
			.setDescription(
				ctx.locale('cmd.help.content', {
					bot: client.user?.username,
					prefix: guild.prefix,
				}) + '\n\n**🌟 Special Features:**\n' + specialFeatures.join('\n')
			)
			.setFooter({
				text: ctx.locale('cmd.help.footer', { prefix: guild.prefix }),
			})
			.addFields(...fields);

		return await ctx.sendMessage({ embeds: [helpEmbed] });
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
