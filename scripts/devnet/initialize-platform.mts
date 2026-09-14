// One-off: creates the PlatformConfig on devnet, naming the operator key.
//   npx tsx scripts/devnet/initialize-platform.mts
//
// Signs with the local Solana CLI wallet, which must be the program's upgrade
// authority — the program refuses anyone else. Safe to re-run: if the config
// already exists it is printed and left alone.
import {
  address,
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getAddressEncoder,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  EMPOWERFI_AUDIT_PROGRAM_ADDRESS,
  fetchMaybePlatformConfig,
  findConfigPda,
  getInitializePlatformInstructionAsync,
} from "../../packages/audit-client/src/generated/index.ts";

// Public key only: the operator's secret never needs to touch this machine's
// scripts — it lives in Supabase Vault for the anchoring pipeline.
const OPERATOR = address("2gHyXDj9q4vzQh4xeniLejhGedF9vfTq99yPv3R2PRQa");
const LOADER_UPGRADEABLE = address("BPFLoaderUpgradeab1e11111111111111111111111");

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");

const walletPath = `${homedir()}/.config/solana/id.json`;
const authority = await createKeyPairSignerFromBytes(
  new Uint8Array(JSON.parse(readFileSync(walletPath, "utf8"))),
);

const [config] = await findConfigPda();
const existing = await fetchMaybePlatformConfig(rpc, config);
if (existing.exists) {
  console.log("PlatformConfig already initialised at", config);
  console.log("  authority:", existing.data.authority);
  console.log("  operator: ", existing.data.operator);
  process.exit(0);
}

const [programData] = await getProgramDerivedAddress({
  programAddress: LOADER_UPGRADEABLE,
  seeds: [getAddressEncoder().encode(EMPOWERFI_AUDIT_PROGRAM_ADDRESS)],
});

const instruction = await getInitializePlatformInstructionAsync({
  authority,
  programData,
  operator: OPERATOR,
});

const { value: blockhash } = await rpc.getLatestBlockhash().send();
const transaction = await signTransactionMessageWithSigners(
  pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(authority, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstruction(instruction, m),
  ),
);

await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(transaction, {
  commitment: "confirmed",
});

const created = await fetchMaybePlatformConfig(rpc, config);
console.log("Initialised PlatformConfig at", config);
console.log("  signature:", getSignatureFromTransaction(transaction));
if (created.exists) {
  console.log("  authority:", created.data.authority);
  console.log("  operator: ", created.data.operator);
}
