import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

export const RandomLoadingMessage = ['Computing...', 'Thinking...', 'Cooking some food', 'Give me a moment', 'Loading...'];

export const BUTTON_IDS = {
	APPLY: 'Guardian:MEMBER_APPLY',
	ACCEPT: 'Guardian:MEMBER_ACCEPT',
	DENY: 'Guardian:MEMBER_DENY',
	JOIN_THREAD: 'Guardian:JOIN_THREAD'
} as const;

export const MODAL_IDS = {
	REASON: 'Guardian:REASON_MODAL',
	ADMIN_REASON: 'Guardian:REASON'
} as const;

export const APPLICATION_ROW = new ActionRowBuilder<ButtonBuilder>()
	.addComponents(new ButtonBuilder().setCustomId(BUTTON_IDS.ACCEPT).setStyle(3).setLabel('Accept').setEmoji('✅'))
	.addComponents(new ButtonBuilder().setCustomId(BUTTON_IDS.DENY).setStyle(4).setLabel('Deny').setEmoji('✖️'));

export const ACCEPTED_MEMBER_ROW = new ActionRowBuilder<ButtonBuilder>()
	.addComponents(new ButtonBuilder().setCustomId(BUTTON_IDS.JOIN_THREAD).setStyle(3).setLabel('Join Thread').setEmoji('🚀'))

export const DISABLED_APPLICATION_ROW = new ActionRowBuilder<ButtonBuilder>().addComponents(
	new ButtonBuilder().setStyle(4).setCustomId('disabled').setLabel('Please wait....').setDisabled(true)
);
