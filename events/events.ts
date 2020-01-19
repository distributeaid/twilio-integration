export enum EventName {
	ChatTokenCreated = 'ChatTokenCreated',
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
