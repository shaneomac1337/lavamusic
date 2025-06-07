import { type GuildMember } from 'discord.js';
import { Command, type Context, type Lavamusic } from '../../structures/index';

export default class Speak extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'speak',
			description: {
				content: 'cmd.speak.description',
				examples: ['speak Hello everyone!', 'speak Welcome to our server'],
				usage: 'speak <text>',
			},
			category: 'music',
			aliases: ['tts'],
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
					description: 'cmd.speak.options.text',
					type: 3,
					required: true,
				},
				{
					name: 'voice',
					description: 'cmd.speak.options.voice',
					type: 3,
					required: false,
					choices: [
						{ name: '🇨🇿 Tereza (Female, Czech)', value: 'cs-CZ-Tereza' },
						{ name: '🇨🇿 Antonín (Male, Czech)', value: 'cs-CZ-Antonin' },
						{ name: '🇺🇸 Amy (Female, English)', value: 'Amy' },
						{ name: '🇺🇸 Brian (Male, English)', value: 'Brian' },
						{ name: '🇺🇸 Emma (Female, English)', value: 'Emma' },
						{ name: '🇺🇸 Eric (Male, English)', value: 'Eric' },
						{ name: '🇺🇸 Joanna (Female, English)', value: 'Joanna' },
						{ name: '🇺🇸 Joey (Male, English)', value: 'Joey' },
						{ name: '🇺🇸 Justin (Male, English)', value: 'Justin' },
						{ name: '🇺🇸 Matthew (Male, English)', value: 'Matthew' },
					],
				},
				{
					name: 'speed',
					description: 'cmd.speak.options.speed',
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
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('event.message.no_voice_channel', { command: 'speak' }))],
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
		let voice = 'cs-CZ-Tereza'; // Default to Czech female voice
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
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.speak.errors.no_text'))],
			});
		}

		if (text.length > 500) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.speak.errors.text_too_long'))],
			});
		}

		await ctx.sendDeferMessage(ctx.locale('cmd.speak.loading'));

		try {
			// Use Flowery TTS with custom voice and speed
			const query = `ftts://${text}?voice=${voice}&speed=${speed}`;
			const response = await player.search({ query }, ctx.author);

			if (!response || !response.tracks || response.tracks.length === 0) {
				return await ctx.editMessage({
					embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.speak.errors.tts_failed'))],
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
						.setDescription(ctx.locale('cmd.speak.success', { text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), voice }))
						.addFields([
							{
								name: ctx.locale('cmd.speak.fields.voice'),
								value: voice,
								inline: true,
							},
							{
								name: ctx.locale('cmd.speak.fields.speed'),
								value: speed.toString(),
								inline: true,
							},
							{
								name: ctx.locale('cmd.speak.fields.length'),
								value: `${text.length} characters`,
								inline: true,
							},
						]),
				],
			});
		} catch (error) {
			this.client.logger.error('TTS Error:', error);
			return await ctx.editMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.speak.errors.tts_failed'))],
			});
		}
	}
}
