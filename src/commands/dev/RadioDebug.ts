import { Command, type Context, type Lavamusic } from '../../structures/index';

export default class RadioDebug extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'radiodebug',
			description: {
				content: 'Debug radio detection system',
				examples: ['radiodebug status', 'radiodebug cleanup'],
				usage: 'radiodebug <action>',
			},
			category: 'dev',
			aliases: ['rd'],
			cooldown: 3,
			args: true,
			vote: false,
			player: {
				voice: false,
				dj: false,
				active: false,
				djPerm: null,
			},
			permissions: {
				dev: true,
				client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
				user: [],
			},
			slashCommand: false,
			options: [],
		});
	}

	public async run(client: Lavamusic, ctx: Context, args: string[]): Promise<void> {
		const action = args[0]?.toLowerCase();

		switch (action) {
			case 'status': {
				const embed = client
					.embed()
					.setAuthor({
						name: 'Radio Detection Debug Status',
						iconURL: client.user?.displayAvatarURL({ extension: 'png' }),
					})
					.setColor(client.color.main)
					.setTimestamp();

				// Get active radio sessions
				const activeRadios = Array.from(client.radioDetection['activeRadioPlayers'].entries());
				const globalIntervals = client.radioDetection['constructor']['allIntervals']?.size || 0;

				if (activeRadios.length === 0) {
					embed.setDescription(`🟢 No active radio detection sessions\n🔍 Global intervals: ${globalIntervals}`);
				} else {
					const statusLines = activeRadios.map(([guildId, radio]) => {
						const guild = client.guilds.cache.get(guildId);
						const guildName = guild ? guild.name : `Unknown (${guildId})`;
						return `**${guildName}**: ${radio.stationId} (Last: ${radio.lastSongId || 'none'})`;
					});

					embed.setDescription(`🔍 **Active Radio Sessions (${activeRadios.length})**\n🔍 **Global intervals: ${globalIntervals}**\n\n${statusLines.join('\n')}`);
				}

				// Add available stations
				const stations = Array.from(client.radioDetection.getAllRadioStations().entries());
				const stationList = stations.map(([id, station]) => `• ${station.name} (${id})`).join('\n');
				embed.addFields([
					{
						name: '📻 Available Stations',
						value: stationList || 'None',
						inline: false,
					},
				]);

				await ctx.sendMessage({ embeds: [embed] });
				break;
			}

			case 'cleanup': {
				client.radioDetection.cleanup();

				const embed = client
					.embed()
					.setAuthor({
						name: 'Radio Detection Cleanup',
						iconURL: client.user?.displayAvatarURL({ extension: 'png' }),
					})
					.setColor(client.color.green)
					.setDescription('🧹 All radio detection intervals have been cleared')
					.setTimestamp();

				await ctx.sendMessage({ embeds: [embed] });
				break;
			}

			case 'force-cleanup': {
				if (!ctx.guild) {
					await ctx.sendMessage({ content: '❌ This command can only be used in a server' });
					return;
				}

				client.radioDetection.forceCleanupGuild(ctx.guild.id);

				const embed = client
					.embed()
					.setAuthor({
						name: 'Radio Detection Force Cleanup',
						iconURL: client.user?.displayAvatarURL({ extension: 'png' }),
					})
					.setColor(client.color.yellow)
					.setDescription(`🔧 Force cleaned radio detection for this server`)
					.setTimestamp();

				await ctx.sendMessage({ embeds: [embed] });
				break;
			}

			case 'force-clear-all': {
				const globalIntervals = client.radioDetection['constructor']['allIntervals']?.size || 0;
				client.radioDetection.cleanup();

				const embed = client
					.embed()
					.setAuthor({
						name: 'Radio Detection Force Clear All',
						iconURL: client.user?.displayAvatarURL({ extension: 'png' }),
					})
					.setColor(client.color.red)
					.setDescription(`🚨 Force cleared all radio detection intervals\n**Cleared:** ${globalIntervals} global intervals`)
					.setTimestamp();

				await ctx.sendMessage({ embeds: [embed] });
				break;
			}

			case 'update-now': {
				if (!ctx.guild) {
					await ctx.sendMessage({ content: '❌ This command can only be used in a server' });
					return;
				}

				await client.radioDetection.forceUpdateNow(ctx.guild.id);

				const embed = client
					.embed()
					.setAuthor({
						name: 'Radio Detection Force Update',
						iconURL: client.user?.displayAvatarURL({ extension: 'png' }),
					})
					.setColor(client.color.blue)
					.setDescription(`🚀 Forced immediate radio song update for this server`)
					.setTimestamp();

				await ctx.sendMessage({ embeds: [embed] });
				break;
			}

			default: {
				await ctx.sendMessage({
					content: '❌ Invalid action. Use: `status`, `cleanup`, `force-cleanup`, `force-clear-all`, or `update-now`'
				});
				break;
			}
		}
	}
}
