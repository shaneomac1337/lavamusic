import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, type Context, type Lavamusic } from '../../structures/index';

export default class Radio extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'radio',
			description: {
				content: 'cmd.radio.description',
				examples: ['radio'],
				usage: 'radio',
			},
			category: 'music',
			aliases: ['radios', 'stations'],
			cooldown: 3,
			args: false,
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
			options: [],
		});
	}

	public async run(client: Lavamusic, ctx: Context): Promise<void> {
		const { guild, member } = ctx;

		if (!guild || !member) {
			await ctx.sendMessage({
				embeds: [
					client
						.embed()
						.setColor(client.color.red)
						.setDescription(ctx.locale('cmd.radio.errors.server_only')),
				],
			});
			return;
		}

		// Get all available radio stations
		const radioStations = Array.from(client.radioDetection.getAllRadioStations().entries());

		if (radioStations.length === 0) {
			await ctx.sendMessage({
				embeds: [
					client
						.embed()
						.setColor(client.color.red)
						.setDescription(ctx.locale('cmd.radio.errors.no_stations')),
				],
			});
			return;
		}

		// Create embed with radio stations
		const embed = client
			.embed()
			.setAuthor({
				name: ctx.locale('cmd.radio.title'),
				iconURL: client.user?.displayAvatarURL({ extension: 'png' }),
			})
			.setColor(client.color.main)
			.setDescription(ctx.locale('cmd.radio.description_text'))
			.setTimestamp();

		// Add radio stations to embed
		let stationList = '';
		const buttons: ButtonBuilder[] = [];
		
		radioStations.forEach(([id, station], index) => {
			// Add to description
			const flag = station.country === 'CZ' ? '🇨🇿' : station.country === 'SK' ? '🇸🇰' : '📻';
			stationList += `${flag} **${station.name}**\n`;
			
			// Create button (Discord allows max 5 buttons per row, max 25 total)
			if (index < 20) { // Limit to 20 stations for button interface
				buttons.push(
					new ButtonBuilder()
						.setCustomId(`radio_${id}`)
						.setLabel(station.name)
						.setStyle(ButtonStyle.Primary)
						.setEmoji('📻')
				);
			}
		});

		embed.addFields([
			{
				name: ctx.locale('cmd.radio.stations_available', { count: radioStations.length }),
				value: stationList || 'No stations available',
				inline: false,
			},
			{
				name: ctx.locale('cmd.radio.how_to_use'),
				value: ctx.locale('cmd.radio.how_to_use_text'),
				inline: false,
			}
		]);

		// Create action rows (max 5 buttons per row)
		const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
		for (let i = 0; i < buttons.length; i += 5) {
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				buttons.slice(i, i + 5)
			);
			actionRows.push(row);
		}

		// Add a refresh button in the last row
		if (actionRows.length > 0) {
			const lastRow = actionRows[actionRows.length - 1];
			if (lastRow.components.length < 5) {
				lastRow.addComponents(
					new ButtonBuilder()
						.setCustomId('radio_refresh')
						.setLabel('Refresh')
						.setStyle(ButtonStyle.Secondary)
						.setEmoji('🔄')
				);
			} else {
				// Create new row for refresh button
				actionRows.push(
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setCustomId('radio_refresh')
							.setLabel('Refresh')
							.setStyle(ButtonStyle.Secondary)
							.setEmoji('🔄')
					)
				);
			}
		}

		const response = await ctx.sendMessage({
			embeds: [embed],
			components: actionRows,
		});

		// Create collector for button interactions
		const collector = response.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 300000, // 5 minutes
		});

		collector.on('collect', async (interaction) => {
			// Check if the user who clicked is the same as who ran the command
			if (interaction.user.id !== ctx.author.id) {
				await interaction.reply({
					content: ctx.locale('cmd.radio.messages.button_permission'),
					flags: 64, // MessageFlags.Ephemeral
				});
				return;
			}

			await interaction.deferReply({ ephemeral: true });

			if (interaction.customId === 'radio_refresh') {
				// Refresh the radio stations display
				const newResponse = await this.run(client, ctx);
				await interaction.editReply({
					content: ctx.locale('cmd.radio.messages.refreshed'),
				});
				return;
			}

			// Extract station ID from button custom ID
			const stationId = interaction.customId.replace('radio_', '');
			const station = client.radioDetection.getRadioStation(stationId);

			if (!station) {
				await interaction.editReply({
					content: ctx.locale('cmd.radio.errors.station_not_found'),
				});
				return;
			}

			try {
				// Get the primary stream URL
				const streamUrl = station.streamUrls[0];
				
				// Use the existing play command logic to play the radio station
				let player = client.manager.getPlayer(guild.id);
				if (!player) {
					// Get the configured text channel for this guild (e.g., "bot-commands")
					const configuredTextChannelId = await client.db.getTextChannel(guild.id);
					const textChannelId = configuredTextChannelId || ctx.channel?.id; // Fallback to current channel

					player = client.manager.createPlayer({
						guildId: guild.id,
						voiceChannelId: member.voice.channelId!,
						textChannelId: textChannelId,
						selfDeafen: true,
					});
				}

				if (!player.connected) {
					await player.connect();
				}

				// Search for the radio stream
				const result = await client.manager.search(streamUrl, ctx.author);

				if (!result || !result.tracks.length) {
					await interaction.editReply({
						content: ctx.locale('cmd.radio.errors.load_failed', { station: station.name }),
					});
					return;
				}

				const track = result.tracks[0];

				// Clear queue and play radio (radio should be exclusive)
				player.queue.tracks.splice(0, player.queue.tracks.length);
				await player.queue.add(track);
				await player.play();

				const flag = station.country === 'CZ' ? '🇨🇿' : station.country === 'SK' ? '🇸🇰' : '📻';
				await interaction.editReply({
					content: ctx.locale('cmd.radio.messages.now_playing', { station: station.name, flag }),
				});

			} catch (error) {
				console.error('Error playing radio station:', error);
				await interaction.editReply({
					content: ctx.locale('cmd.radio.errors.play_failed', { station: station.name }),
				});
			}
		});

		collector.on('end', async () => {
			// Disable all buttons when collector expires
			const disabledRows = actionRows.map(row => {
				const newRow = new ActionRowBuilder<ButtonBuilder>();
				row.components.forEach(button => {
					newRow.addComponents(
						ButtonBuilder.from(button).setDisabled(true)
					);
				});
				return newRow;
			});

			try {
				await response.edit({
					components: disabledRows,
				});
			} catch (error) {
				// Message might have been deleted
				console.log('Could not disable radio buttons:', error);
			}
		});
	}
}
