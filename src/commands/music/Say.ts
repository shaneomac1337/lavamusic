import { type GuildMember } from 'discord.js';
import { Command, type Context, type Lavamusic } from '../../structures/index';

export default class Say extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'say',
			description: {
				content: 'cmd.say.description',
				examples: ['say Hello world!', 'say Welcome to the server'],
				usage: 'say <text>',
			},
			category: 'music',
			aliases: ['quicktts'],
			cooldown: 3,
			args: true,
			vote: false,
			player: {
				voice: true,
				dj: false,
				active: false,
				djPerm: null,
			},
			permissions: {
				dev: false,
				client: ['SendMessages', 'ReadMessageHistory', 'ViewChannel', 'EmbedLinks', 'Connect', 'Speak'],
				user: [],
			},
			slashCommand: true,
			options: [
				{
					name: 'text',
					description: 'cmd.say.options.text',
					type: 3,
					required: true,
				},
			],
		});
	}

	public async run(client: Lavamusic, ctx: Context, args: string[]): Promise<any> {
		const embed = this.client.embed();
		const memberVoiceChannel = (ctx.member as GuildMember).voice?.channel;

		if (!memberVoiceChannel) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('event.message.no_voice_channel', { command: 'say' }))],
			});
		}

		let player = client.manager.getPlayer(ctx.guild!.id);
		if (!player) {
			player = client.manager.createPlayer({
				guildId: ctx.guild!.id,
				voiceChannelId: memberVoiceChannel.id,
				textChannelId: ctx.channel.id,
				selfMute: false,
				selfDeaf: true,
				vcRegion: memberVoiceChannel.rtcRegion!,
			});
		}

		if (!player.connected) await player.connect();

		// Get text from args or slash command
		let text: string;
		if (ctx.isInteraction) {
			text = ctx.options.get('text')?.value as string;
		} else {
			text = args.join(' ');
		}

		if (!text || text.length === 0) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.say.errors.no_text'))],
			});
		}

		if (text.length > 200) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.say.errors.text_too_long'))],
			});
		}

		await ctx.sendDeferMessage(ctx.locale('cmd.say.loading'));

		try {
			// Use DuncteBot TTS (simpler, faster)
			const query = `speak:${text}`;
			const response = await player.search({ query }, ctx.author);

			if (!response || !response.tracks || response.tracks.length === 0) {
				return await ctx.editMessage({
					embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.say.errors.tts_failed'))],
				});
			}

			const track = response.tracks[0];
			await player.queue.add(track);

			if (!player.playing && !player.paused) {
				await player.play();
			}

			return await ctx.editMessage({
				embeds: [
					embed
						.setColor(this.client.color.main)
						.setDescription(ctx.locale('cmd.say.success', { text: text.substring(0, 150) + (text.length > 150 ? '...' : '') }))
						.addFields([
							{
								name: ctx.locale('cmd.say.fields.text_length'),
								value: `${text.length} characters`,
								inline: true,
							},
							{
								name: ctx.locale('cmd.say.fields.voice'),
								value: 'Default TTS Voice',
								inline: true,
							},
						]),
				],
			});
		} catch (error) {
			this.client.logger.error('TTS Error:', error);
			return await ctx.editMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.say.errors.tts_failed'))],
			});
		}
	}
}
