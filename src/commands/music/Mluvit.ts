import { type GuildMember } from 'discord.js';
import { Command, type Context, type Lavamusic } from '../../structures/index';

export default class Mluvit extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'mluvit',
			description: {
				content: 'cmd.mluvit.description',
				examples: ['mluvit Ahoj všichni!', 'mluvit Vítejte na našem serveru'],
				usage: 'mluvit <text>',
			},
			category: 'music',
			aliases: ['czech', 'cesky'],
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
					description: 'cmd.mluvit.options.text',
					type: 3,
					required: true,
				},
				{
					name: 'voice',
					description: 'cmd.mluvit.options.voice',
					type: 3,
					required: false,
					choices: [
						{ name: '🇨🇿 Tereza (Žena)', value: 'cs-CZ-Tereza' },
						{ name: '🇨🇿 Antonín (Muž)', value: 'cs-CZ-Antonin' },
					],
				},
				{
					name: 'speed',
					description: 'cmd.mluvit.options.speed',
					type: 10,
					required: false,
					min_value: 0.5,
					max_value: 2.0,
				},
			],
		});
	}

	public async run(client: Lavamusic, ctx: Context, args: string[]): Promise<any> {
		const embed = this.client.embed();
		const memberVoiceChannel = (ctx.member as GuildMember).voice?.channel;

		if (!memberVoiceChannel) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('event.message.no_voice_channel', { command: 'mluvit' }))],
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
		let voice = 'cs-CZ-Tereza'; // Default Czech female voice
		let speed = 1.0;

		if (ctx.isInteraction) {
			text = ctx.options.get('text')?.value as string;
			voice = (ctx.options.get('voice')?.value as string) || 'cs-CZ-Tereza';
			speed = (ctx.options.get('speed')?.value as number) || 1.0;
		} else {
			text = args.join(' ');
		}

		if (!text || text.length === 0) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.mluvit.errors.no_text'))],
			});
		}

		if (text.length > 500) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.mluvit.errors.text_too_long'))],
			});
		}

		await ctx.sendDeferMessage(ctx.locale('cmd.mluvit.loading'));

		try {
			// Use Flowery TTS with Czech voice
			const query = `ftts://${text}?voice=${voice}&speed=${speed}`;
			const response = await player.search({ query }, ctx.author);

			if (!response || !response.tracks || response.tracks.length === 0) {
				return await ctx.editMessage({
					embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.mluvit.errors.tts_failed'))],
				});
			}

			const track = response.tracks[0];
			await player.queue.add(track);

			if (!player.playing && !player.paused) {
				await player.play();
			}

			const voiceName = voice === 'cs-CZ-Tereza' ? 'Tereza (Žena)' : 'Antonín (Muž)';

			return await ctx.editMessage({
				embeds: [
					embed
						.setColor(this.client.color.main)
						.setDescription(ctx.locale('cmd.mluvit.success', { text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), voice: voiceName }))
						.addFields([
							{
								name: ctx.locale('cmd.mluvit.fields.voice'),
								value: voiceName,
								inline: true,
							},
							{
								name: ctx.locale('cmd.mluvit.fields.speed'),
								value: speed.toString(),
								inline: true,
							},
							{
								name: ctx.locale('cmd.mluvit.fields.length'),
								value: `${text.length} znaků`,
								inline: true,
							},
						]),
				],
			});
		} catch (error) {
			this.client.logger.error('Czech TTS Error:', error);
			return await ctx.editMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.mluvit.errors.tts_failed'))],
			});
		}
	}
}
