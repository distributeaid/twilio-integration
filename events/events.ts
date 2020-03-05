export enum EventName {
	ChatTokenCreated = 'ChatTokenCreated',
	NickUpdated = 'NickUpdated',
	ChannelSubscriptionCreated = 'ChannelSubscriptionCreated',
}

export type Event = {
	eventName: EventName
}

export type EventWithPayload<P = { [key: string]: any }> = Event & {
	eventPayload: P
}

type ChatTokenCreatedEventPayload = { identity: string; contexts: string[] }
export type ChatTokenCreatedEvent = EventWithPayload<
	ChatTokenCreatedEventPayload
>
export const ChatTokenCreated = (
	eventPayload: ChatTokenCreatedEventPayload,
): ChatTokenCreatedEvent => ({
	eventName: EventName.ChatTokenCreated,
	eventPayload,
})

type NickUpdatedEventPayload = { identity: string; nick: string }
export type NickUpdatedEvent = EventWithPayload<NickUpdatedEventPayload>
export const NickUpdated = (
	eventPayload: NickUpdatedEventPayload,
): NickUpdatedEvent => ({
	eventName: EventName.NickUpdated,
	eventPayload,
})

type ChannelSubscriptionCreatedEventPayload = {
	uuid: string
	identity: string
	channel: string
	email: string
}
export type ChannelSubscriptionCreatedEvent = EventWithPayload<
	ChannelSubscriptionCreatedEventPayload
>
export const ChannelSubscriptionCreated = (
	eventPayload: ChannelSubscriptionCreatedEventPayload,
): ChannelSubscriptionCreatedEvent => ({
	eventName: EventName.ChannelSubscriptionCreated,
	eventPayload,
})
