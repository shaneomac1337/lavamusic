import Lavamusic from './structures/Lavamusic';
import { ClientOptions, GatewayIntentBits } from 'discord.js';
import config from './config';
import { bootstrap } from './api/main';
const { GuildMembers, MessageContent, GuildVoiceStates, GuildMessages, Guilds, GuildMessageTyping } = GatewayIntentBits;
const clientOptions: ClientOptions = {
    intents: [Guilds, GuildMessages, MessageContent, GuildVoiceStates, GuildMembers, GuildMessageTyping],
    allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: false,
    },
};

const client = new Lavamusic(clientOptions);

client.start(config.token);

if (config.dashboard.enable) {
    bootstrap();
}

/**
 * Project: lavamusic
 * Author: Blacky
 * Company: Coders
 * Copyright (c) 2023. All rights reserved.
 * This code is the property of Coder and may not be reproduced or
 * modified without permission. For more information, contact us at
 * https://discord.gg/ns8CTk9J3e
 */
