import { ApplicationCommandOptionType } from 'discord.js';
import Command from '../../structures/Command';
import type Context from '../../structures/Context';
import type Lavamusic from '../../structures/Lavamusic';

export default class Source extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'source',
			description: {
				content: 'cmd.source.description',
				examples: ['source set spotify', 'source show', 'source list'],
				usage: 'source <set|show|list> [source]',
			},
			category: 'music',
			aliases: ['src'],
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
					name: 'set',
					description: 'cmd.source.options.set',
					type: ApplicationCommandOptionType.Subcommand,
					options: [
						{
							name: 'source',
							description: 'cmd.source.options.source',
							type: ApplicationCommandOptionType.String,
							required: true,
							choices: [
								{
									name: '🎵 YouTube Music',
									value: 'youtubemusic',
								},
								{
									name: '🟢 Spotify',
									value: 'spotify',
								},
								{
									name: '🔴 YouTube',
									value: 'youtube',
								},
								{
									name: '🟠 SoundCloud',
									value: 'soundcloud',
								},
							],
						},
					],
				},
				{
					name: 'show',
					description: 'cmd.source.options.show',
					type: ApplicationCommandOptionType.Subcommand,
				},
				{
					name: 'list',
					description: 'cmd.source.options.list',
					type: ApplicationCommandOptionType.Subcommand,
				},
			],
		});
	}

	public async run(client: Lavamusic, ctx: Context, args: string[]): Promise<any> {
		const embed = this.client.embed().setColor(this.client.color.main);
		const userId = ctx.author?.id!;
		const isInteraction = ctx.isInteraction;
		let subCommand: string | undefined;
		let sourceValue: string | undefined;

		if (isInteraction) {
			subCommand = ctx.options.getSubCommand();
			if (subCommand === 'set') {
				sourceValue = ctx.options.getString('source');
			}
		} else {
			subCommand = args[0] || 'show';
			sourceValue = args[1];
		}

		const sourceMap = {
			youtubemusic: { name: 'YouTube Music', icon: '🎵' },
			spotify: { name: 'Spotify', icon: '🟢' },
			youtube: { name: 'YouTube', icon: '🔴' },
			soundcloud: { name: 'SoundCloud', icon: '🟠' },
		};

		switch (subCommand) {
			case 'set': {
				console.log(`[DEBUG] Source set command - userId: ${userId}, sourceValue: ${sourceValue}`);

				if (!sourceValue || !sourceMap[sourceValue as keyof typeof sourceMap]) {
					embed.setDescription(ctx.locale('cmd.source.errors.invalid_source'));
					return await ctx.sendMessage({ embeds: [embed] });
				}

				await client.db.setUserPreferredSource(userId, sourceValue);
				console.log(`[DEBUG] User preference saved: ${userId} -> ${sourceValue}`);

				const source = sourceMap[sourceValue as keyof typeof sourceMap];

				embed.setDescription(
					ctx.locale('cmd.source.messages.source_set', {
						icon: source.icon,
						name: source.name,
					}),
				);
				return await ctx.sendMessage({ embeds: [embed] });
			}

			case 'list': {
				const sourceList = Object.entries(sourceMap)
					.map(([key, value]) => `${value.icon} **${value.name}** \`${key}\``)
					.join('\n');

				embed.setTitle(ctx.locale('cmd.source.messages.available_sources'));
				embed.setDescription(sourceList);
				embed.setFooter({ text: ctx.locale('cmd.source.messages.usage_hint') });
				return await ctx.sendMessage({ embeds: [embed] });
			}

			case 'show':
			default: {
				const currentSource = await client.db.getUserPreferredSource(userId);
				console.log(`[DEBUG] Source show command - userId: ${userId}, currentSource: ${currentSource}`);

				const source = sourceMap[currentSource as keyof typeof sourceMap] || sourceMap.youtubemusic;

				embed.setDescription(
					ctx.locale('cmd.source.messages.current_source', {
						icon: source.icon,
						name: source.name,
					}),
				);
				return await ctx.sendMessage({ embeds: [embed] });
			}
		}
	}
}
