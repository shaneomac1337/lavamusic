import { EmbedBuilder } from 'discord.js';
import { Command, type Context, type Lavamusic } from '../../structures/index';

export default class Developer extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'developer',
			description: {
				content: 'cmd.developer.description',
				examples: ['developer'],
				usage: 'developer',
			},
			category: 'info',
			aliases: ['dev', 'author', 'creator'],
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
			options: [],
		});
	}

	public async run(client: Lavamusic, ctx: Context): Promise<any> {
		const embed = new EmbedBuilder()
			.setColor(client.color.main)
			.setTitle('🛠️ Developer Information')
			.setDescription('Information about the developer of this bot')
			.addFields([
				{
					name: '👨‍💻 Developer',
					value: '**Martin Pěnkava**',
					inline: true,
				},
				{
					name: '🏢 Organization',
					value: '**Komplexáci**',
					inline: true,
				},
				{
					name: '🌍 Location',
					value: '🇨🇿 Czech Republic',
					inline: true,
				},
				{
					name: '🎵 Bot Features',
					value: '• Music Streaming\n• Czech TTS Support\n• Advanced Audio Filters\n• Playlist Management',
					inline: false,
				},
				{
					name: '🔧 Technologies Used',
					value: '• Discord.js\n• Lavalink\n• TypeScript\n• Node.js',
					inline: true,
				},
				{
					name: '🎤 TTS Voices',
					value: '• Czech (Tereza)\n• Czech (Antonín)\n• Multiple Languages',
					inline: true,
				},
				{
					name: '📊 Bot Statistics',
					value: `• Servers: ${client.guilds.cache.size}\n• Users: ${client.users.cache.size}\n• Uptime: ${client.utils.formatTime(client.uptime || 0)}`,
					inline: false,
				},
			])
			.setFooter({
				text: 'Developed with ❤️ by Martin Pěnkava from Komplexáci',
				iconURL: client.user?.displayAvatarURL(),
			})
			.setTimestamp();

		return await ctx.sendMessage({
			embeds: [embed],
		});
	}
}
