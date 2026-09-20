/**
 * Modules without usable published types.
 *
 * socket.io-client and twilio both ship their own types, so they are no longer
 * declared here. What remains is a transitive dependency that has none.
 */

declare module 'xmlhttprequest-ssl';
