import { NextRequest, NextResponse } from "next/server";
import { ReactNode } from "react";
import {
  Transaction,
  PublicKey,
  SystemProgram,
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostResponse
} from "@solana/actions";
import { NextActionLink } from "@solana/actions-spec";
import { useSearchParams } from "next/navigation";
import * as splToken from '@solana/spl-token';

let connection: Connection;
if (USE_DEV){
  connection = new Connection(clusterApiUrl("devnet"), "confirmed");
} else {
  connection = (process.env.HELIUS_API_TOKEN != "") ? 
  new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_TOKEN}`) : 
  new Connection(clusterApiUrl("mainnet-beta"));
}

import { getCompletedAction, generateImgAction } from "@/app/helper";
import axios from "axios";
import { USC_DECIMALS, USDC_PUB_KEY, USE_DEV, WALLET_PUB_KEY } from "@/consts";

const pubkeyToDonateTo = '4ypD7kxRj9DLF3PMxsY3qvp8YdNhAHZRnN3fyVDh5CFX'

export async function GET(req: NextRequest) {
    const requestUrl = new URL(req.url);
    //const { toPubkey } = validatedQueryParams(requestUrl);

    const baseHref = new URL(
        `/api/action?`,
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
              label: 'Generate image ($0.10 USDC)', // button text
              href: `${baseHref}prompt={prompt}&email={email}`, // this href will have a text input
              parameters: [
                {
                  type: "textarea",
                  required: true,
                  name: "prompt",
                  label: "Describe the image",
                },
                {
                  type: "email",
                  required: false,
                  name: "email",
                  label: "Email address to receive image (optional)",
                },
              ],
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { account: string; signature: string };
    const requestUrl = new URL(req.url);
    const origin = requestUrl.origin
    const { searchParams } = new URL(req.url);
    // amount is just to show how to decide the next action
    const prompt = searchParams.get("prompt") as string;

    // stage is the stage of the action in the chain
    const email = searchParams.get("email") as string;

    if (!prompt) {
      return new Response("Please enter a prompt to generate an image", {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
    const decimals = USC_DECIMALS; // In the example, we use 6 decimals for USDC, but you can use any SPL token
    const mintAddress = new PublicKey(`${USDC_PUB_KEY}`); // replace this with any SPL token mint address

    // converting value to fractional units

    let instructions = []

    let transferAmount: any = 0.10;
    transferAmount = transferAmount.toFixed(decimals);
    transferAmount = transferAmount * Math.pow(10, decimals);

    let userAccount = new PublicKey(body.account)
    let paymentWallet = new PublicKey(WALLET_PUB_KEY)

    const fromTokenAccount = await splToken.getAssociatedTokenAddress(
      mintAddress,
      userAccount,
      true,
      splToken.TOKEN_PROGRAM_ID,
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    let toTokenAccount = await splToken.getAssociatedTokenAddress(
      mintAddress,
      paymentWallet,
      true,
      splToken.TOKEN_PROGRAM_ID,
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const ifexists = await connection.getAccountInfo(toTokenAccount);

    if (!ifexists || !ifexists.data) {
      let createATAiX = splToken.createAssociatedTokenAccountInstruction(
        userAccount,
        toTokenAccount,
        paymentWallet,
        mintAddress,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      instructions.push(createATAiX);
    }

    let transferInstruction = splToken.createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      userAccount,
      transferAmount,
    );
    instructions.push(transferInstruction);

    // get the latest blockhash amd block height
    const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

    const transaction = new Transaction({
      feePayer: userAccount,
      blockhash,
      lastValidBlockHeight,
    }).add(...instructions);

    transaction.add(
      new TransactionInstruction({
        keys: [{ pubkey: userAccount, isSigner: true, isWritable: true }],
        data: Buffer.from("imggenblink.xyz", "utf-8"),
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      }),
    );

    console.log("execute next post")
    console.log(`${origin} /api/action/generate`)

    return NextResponse.json(
        await createPostResponse({
          fields: {
            links: {
              next: generateImgAction(origin, [prompt, email]) 
            },
            transaction,
            message: `Generated image`,
          },
        }),
        {
          headers: ACTIONS_CORS_HEADERS,
        }
      );

  } catch (err) {
    console.log("Error in POST /api/action", err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new Response(message, {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
}