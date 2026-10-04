import { MeraError, type PasskeyCredentialTransport, type WebAuthnClient } from "@category-labs/mera";

type PrfResults = { enabled?: boolean; results?: { first?: BufferSource; second?: BufferSource } };

/** A PRF result as its own bytes. WebAuthn hands back an ArrayBuffer, or a view on one. */
function bytes(value: BufferSource | undefined): Uint8Array | undefined {
  if (!value) return undefined;
  const view = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return new Uint8Array(view);
}

function asPublicKeyCredential(credential: Credential | null | undefined): PublicKeyCredential {
  if (credential?.type !== "public-key" || !("rawId" in credential) || typeof (credential as PublicKeyCredential).getClientExtensionResults !== "function") {
    throw new MeraError("PASSKEY_OPERATION_FAILED", "WebAuthn returned no usable public key credential");
  }
  return credential as PublicKeyCredential;
}

/**
 * A WebAuthn client for Mera that evaluates a second PRF salt in the same ceremony (#41). Mera still receives the first
 * output, exactly as from its own browser client; the second is kept here for the caller. One Face ID can then yield
 * both of Curb's keys, and they still come from different salts (D-012). Apart from `second`, this mirrors Mera's
 * `browserWebAuthnClient` (dist/webauthn.js, 0.2.0) line for line.
 */
export function dualSaltClient(second: Uint8Array<ArrayBuffer>) {
  let secondOutput: Uint8Array | undefined;
  const client: WebAuthnClient = {
    async createCredential(request) {
      const credential = await globalThis.navigator?.credentials?.create({
        publicKey: {
          rp: request.rp,
          user: request.user,
          challenge: request.challenge,
          pubKeyCredParams: request.algorithms.map((alg) => ({ type: "public-key" as const, alg })),
          ...(request.timeout !== undefined ? { timeout: request.timeout } : {}),
          attestation: request.attestation,
          authenticatorSelection: { residentKey: request.residentKey, requireResidentKey: true, userVerification: request.userVerification },
          extensions: { prf: { eval: { first: request.prfSalt, second } } } as AuthenticationExtensionsClientInputs,
        },
      });
      const pk = asPublicKeyCredential(credential);
      const prf = (pk.getClientExtensionResults() as { prf?: PrfResults }).prf;
      const response = pk.response as AuthenticatorAttestationResponse;
      const transports = typeof response.getTransports === "function" ? (response.getTransports() as PasskeyCredentialTransport[]) : undefined;
      const first = bytes(prf?.results?.first);
      secondOutput = bytes(prf?.results?.second) ?? secondOutput;
      return {
        credentialId: new Uint8Array(pk.rawId),
        ...(transports !== undefined ? { transports } : {}),
        prfEnabled: prf?.enabled === true,
        ...(first ? { prfOutput: first } : {}),
      };
    },
    async getCredential(request) {
      const { allowCredential } = request;
      const credential = await globalThis.navigator?.credentials?.get({
        publicKey: {
          rpId: request.rpId,
          challenge: request.challenge,
          ...(request.timeout !== undefined ? { timeout: request.timeout } : {}),
          userVerification: request.userVerification,
          extensions: { prf: { eval: { first: request.prfSalt, second } } } as AuthenticationExtensionsClientInputs,
          ...(allowCredential !== undefined
            ? {
                allowCredentials: [
                  {
                    id: allowCredential.credentialId,
                    type: "public-key" as const,
                    ...(allowCredential.transports !== undefined ? { transports: allowCredential.transports as AuthenticatorTransport[] } : {}),
                  },
                ],
              }
            : {}),
        },
      });
      const pk = asPublicKeyCredential(credential);
      const prf = (pk.getClientExtensionResults() as { prf?: PrfResults }).prf;
      const first = bytes(prf?.results?.first);
      secondOutput = bytes(prf?.results?.second) ?? secondOutput;
      return { credentialId: new Uint8Array(pk.rawId), ...(first ? { prfOutput: first } : {}) };
    },
  };
  /** The second salt's output from the last ceremony, when the authenticator evaluated both. */
  return { client, second: () => secondOutput };
}
