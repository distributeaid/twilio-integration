export type Event = {
	eventName: string
}

export type EventWithPayload<P = { [key: string]: any }> = Event & {
	eventPayload: P
}

export const ChatTokenCreatedEvent = (payload: {
	identity: string
	contexts: string[]
}): EventWithPayload<{ identity: string; contexts: string[] }> => ({
	eventName: 'ChatTokenCreated',
	eventPayload: payload,
})
