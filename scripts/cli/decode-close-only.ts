#!/usr/bin/env tsx
// Decode close event only (no open-side walk) so we can verify the patched
// IDL produces sane field values without burning RPC on a 200-sig history.
import { Connection } from "@solana/web3.js";
import { fetchTxEvents } from "../parsers/tx-parser";
import { USD_SCALE } from "../constants/adrena";

async function main() {
  const sig = process.argv[2];
  if (!sig) {
    console.error("usage: decode-close-only <signature>");
    process.exit(1);
  }
  const rpc =
    process.env.NEXT_PUBLIC_SOLANA_RPC ??
    "https://api.mainnet-beta.solana.com";
  const c = new Connection(rpc, "confirmed");
  const r = await fetchTxEvents(c, sig);
  if (!r) return console.log("not found");
  if (!r.close) {
    console.log("no ClosePositionEvent; events =", r.events.map((e) => e.name));
    return;
  }
  const cl = r.close;
  console.log(
    JSON.stringify(
      {
        signature: sig,
        blockTime: r.blockTime,
        slot: r.slot,
        close: {
          owner: cl.owner.toBase58(),
          position: cl.position.toBase58(),
          custodyMint: cl.custodyMint.toBase58(),
          side: cl.side,
          sizeUsd_raw: cl.sizeUsd.toString(),
          sizeUsd_div1e6: Number(cl.sizeUsd.toString()) / USD_SCALE,
          price_raw: cl.price.toString(),
          price_div1e6: Number(cl.price.toString()) / USD_SCALE,
          price_div1e10: Number(cl.price.toString()) / 1e10,
          price_div1e16: Number(cl.price.toString()) / 1e16,
          collateralAmountUsd_div1e6:
            Number(cl.collateralAmountUsd.toString()) / USD_SCALE,
          profitUsd_div1e6: Number(cl.profitUsd.toString()) / USD_SCALE,
          lossUsd_div1e6: Number(cl.lossUsd.toString()) / USD_SCALE,
          borrowFeeUsd_div1e6: Number(cl.borrowFeeUsd.toString()) / USD_SCALE,
          exitFeeUsd_div1e6: Number(cl.exitFeeUsd.toString()) / USD_SCALE,
          positionId: cl.positionId.toString(),
          percentage: cl.percentage.toString(),
          fundingPaidUsd_div1e6: Number(cl.fundingPaidUsd.toString()) / USD_SCALE,
          fundingReceivedUsd_div1e6:
            Number(cl.fundingReceivedUsd.toString()) / USD_SCALE,
          poolType: cl.poolType,
        },
      },
      null,
      2,
    ),
  );
}
main().catch(console.error);
