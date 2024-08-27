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
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
//const connection = new Connection(clusterApiUrl("mainnet-beta"));
import { getCompletedAction, generateImgAction } from "@/app/helper";
import axios from "axios";

const pubkeyToDonateTo = '4ypD7kxRj9DLF3PMxsY3qvp8YdNhAHZRnN3fyVDh5CFX'

export async function GET(req: NextRequest) {
    const requestUrl = new URL(req.url);
    const { toPubkey } = validatedQueryParams(requestUrl);

    const baseHref = new URL(
        `/api/action?to=${toPubkey.toBase58()}`,
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
              href: `${baseHref}&prompt={prompt}&email={email}`, // this href will have a text input
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
                  label: "Email address to receive image",
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

    const sender = new PublicKey(body.account);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: new PublicKey(pubkeyToDonateTo),
        lamports: LAMPORTS_PER_SOL * 0.0001,
      })
    );
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = sender;
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: sender, isSigner: true, isWritable: true }],
        data: Buffer.from("imggenblink.xyz", "utf-8"),
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      }),
    );

    return NextResponse.json(
        await createPostResponse({
          fields: {
            links: {
              next: generateImgAction([prompt, email]) 
            },
            transaction: tx,
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

function validatedQueryParams(requestUrl: URL) {
    let toPubkey: PublicKey = new PublicKey(
      pubkeyToDonateTo,
    );
  
    try {
      if (requestUrl.searchParams.get('to')) {
        toPubkey = new PublicKey(requestUrl.searchParams.get('to')!);
      }
    } catch (err) {
      throw 'Invalid input query parameter: to';
    }
  
    return {
      toPubkey,
    };
  }