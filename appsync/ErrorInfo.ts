export enum ErrorType {
	EntityNotFound = 'EntityNotFound',
	BadRequest = 'BadRequest',
	AccessDenied = 'AccessDenied',
	InternalError = 'InternalError',
	Conflict = 'Conflict',
}

export type ErrorInfo = {
	type: ErrorType
	message: string
}
