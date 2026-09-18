declare module 'socket.io-client' {
  export type Socket = any;
  export function io(...args: any[]): any;
}

declare module 'twilio' {
  const twilio: any;
  export default twilio;
  export type Twilio = any;
}

declare module 'xmlhttprequest-ssl';

// Allow tests to use loose any for socket event payloads
interface NodeJSGlobal {
  fetch?: any;
}
