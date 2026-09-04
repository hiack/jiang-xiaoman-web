export type AllowedStreamEvent =
  | { event: 'delta'; answer: string }
  | { event: 'done'; conversationId: string }
  | { event: 'error'; message: string }
