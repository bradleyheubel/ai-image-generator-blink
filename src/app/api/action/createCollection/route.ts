import { VersionedTransaction, Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { ActionGetResponse, ActionPostResponse, ACTIONS_CORS_HEADERS, createPostResponse } from '@solana/actions';
import axios from 'axios';
import { extname } from 'path';
import { USE_DEV } from '@/consts';

let connection: Connection;
if (USE_DEV){
  connection = new Connection(clusterApiUrl("devnet"), "confirmed");
} else {
  connection = (process.env.HELIUS_API_TOKEN != "") ? 
  new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_TOKEN}`) : 
  new Connection(clusterApiUrl("mainnet-beta"));
}

export async function GET(req: NextRequest) {

    const requestUrl = new URL(req.url);
    
    const basePumpHref = new URL(
        `/api/action/createCollection`,
        requestUrl.origin,
    ).toString();

    let response: ActionGetResponse = {
        type: "action",
        icon: `${requestUrl.origin}/robot-artist.jpg`,
        title: "Generate AI Image",
        description: "Generate an AI image",
        label: "generate",
        links: {
            actions: [
                {
                  label: 'test pumpfun', // button text
                  href: `${basePumpHref}`, // this href will have a text input
                },
            ]
        },
    };
  
    return NextResponse.json(response, {
      headers: ACTIONS_CORS_HEADERS,
    });
}
  
// ensures cors
export const OPTIONS = GET;

async function streamToString(stream: any) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

export async function POST(req: NextRequest) {

    const toPubKey = req.nextUrl.searchParams.get('minter') || ""
    const imgurl = decodeURIComponent(req.nextUrl.searchParams.get('imgURL') || "")
    const tokenName = req.nextUrl.searchParams.get('name') || ""
    const tokenTicker = req.nextUrl.searchParams.get('ticker') || ""
    const desc = req.nextUrl.searchParams.get('desc') || ""
    const twitter = decodeURIComponent(req.nextUrl.searchParams.get('x') || "")
    const telegram = decodeURIComponent(req.nextUrl.searchParams.get('tg') || "")
    const website = decodeURIComponent(req.nextUrl.searchParams.get('web') || "")

    console.log(`Data: ${toPubKey} | ${imgurl} | ${tokenName} | ${tokenTicker}`)
    console.log(`${desc}`)
    console.log(`${twitter} | ${telegram} | ${website}`)

    const fileFetch = await fetch(imgurl)
    const buffer = await fileFetch.arrayBuffer();
    const fileData = Buffer.from(buffer);
    const blob = new Blob([fileData])

    // Generate a random keypair for token
    const mintKeypair = Keypair.generate(); 

    const sender = new PublicKey(toPubKey);

    const formData = new FormData();
    formData.append("file", blob), // Image file await fs.openAsBlob(path)
    formData.append("name", tokenName),
    formData.append("symbol", tokenTicker.toUpperCase()),
    formData.append("description", desc),
    formData.append("twitter", twitter),
    formData.append("telegram", telegram),
    formData.append("website", website),
    formData.append("showName", "true");

    const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
        method: "POST",
        body: formData,
    });
    const metadataResponseJSON = await metadataResponse.json();
    console.log(metadataResponseJSON)

    // Get the create transaction
    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "publicKey": toPubKey,
            "action": "create",
            "tokenMetadata": {
                name: metadataResponseJSON.metadata.name,
                symbol: metadataResponseJSON.metadata.symbol,
                uri: metadataResponseJSON.metadataUri
            },
            "mint": mintKeypair.publicKey.toBase58(),
            "denominatedInSol": "true",
            "amount": 0.001, // dev buy of 0.001 SOL
            "slippage": 10, 
            "priorityFee": 0.0005,
            "pool": "pump"
        })
    });

    if(response.status === 200){ // successfully generated transaction
        console.log("gerated token")
    // get the latest blockhash amd block height
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  
    const data = await response.arrayBuffer();

    console.log(response)
    
    const transaction = VersionedTransaction.deserialize(new Uint8Array(data))
    transaction.sign([mintKeypair])
    const payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction,
          message: `Launched to Pump.Fun! You also hold 0.001 SOL worth of ${tokenTicker.toUpperCase()}`,
        },
      });
    
    return Response.json(payload, {
        headers: ACTIONS_CORS_HEADERS,
      });

    } else {
        console.log(response.statusText); // log error
    }

}