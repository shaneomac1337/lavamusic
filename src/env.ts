import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

config({
	path: path.join(__dirname, '../.env'),
});

const LavalinkNodeSchema = z.object({
	id: z.string(),
	host: z.string(),
	port: z.number(),
	authorization: z.string(),
	secure: z.preprocess(val => (val === 'true' || val === 'false' ? val === 'true' : val), z.boolean().optional()),
	sessionId: z.string().optional(),
	regions: z.string().array().optional(),
	retryAmount: z.number().optional(),
	retryDelay: z.number().optional(),
	requestSignalTimeoutMS: z.number().optional(),
	closeOnError: z.boolean().optional(),
	heartBeatInterval: z.number().optional(),
	enablePingOnStatsCheck: z.boolean().optional(),
});

const envSchema = z.object({
	TOKEN: z.string(),
	CLIENT_ID: z.string(),
	CLIENT_SECRET: z.string().optional(),
	DEFAULT_LANGUAGE: z.string().default('EnglishUS'),
	PREFIX: z.string().default('!'),
	OWNER_IDS: z.preprocess(val => (typeof val === 'string' ? JSON.parse(val) : val), z.string().array().optional()),
	GUILD_ID: z.string().optional(),
	TOPGG: z.string().optional(),
	KEEP_ALIVE: z.preprocess(val => val === 'true', z.boolean().default(false)),
	LOG_CHANNEL_ID: z.string().optional(),
	LOG_COMMANDS_ID: z.string().optional(),
	BOT_STATUS: z.preprocess(
		val => {
			if (typeof val === 'string') {
				return val.toLowerCase();
			}
			return val;
		},
		z.enum(['online', 'idle', 'dnd', 'invisible']).default('online'),
	),
	BOT_ACTIVITY: z.string().default('Lavamusic'),
	BOT_ACTIVITY_TYPE: z.preprocess(val => {
		if (typeof val === 'string') {
			return Number.parseInt(val, 10);
		}
		return val;
	}, z.number().default(0)),
	DATABASE_URL: z.string().optional(),
	SEARCH_ENGINE: z.preprocess(
		val => {
			if (typeof val === 'string') {
				return val.toLowerCase();
			}
			return val;
		},
		z
			.enum(['youtube', 'youtubemusic', 'soundcloud', 'spotify', 'apple', 'deezer', 'yandex', 'jiosaavn'])
			.default('youtube'),
	),
	NODES: z.preprocess(val => (typeof val === 'string' ? JSON.parse(val) : val), z.array(LavalinkNodeSchema)),
	GENIUS_API: z.string().optional(),
	WEB_DASHBOARD: z.preprocess(val => val === 'true', z.boolean().default(false)),
	DASHBOARD_PORT: z.preprocess(val => {
		if (typeof val === 'string') {
			return Number.parseInt(val, 10);
		}
		return val;
	}, z.number().default(3001)),
	DASHBOARD_SECRET: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

for (const key in env) {
	if (!(key in env)) {
		throw new Error(`Missing env variable: ${key}. Please check the .env file and try again.`);
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
