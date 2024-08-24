import { NextRequest, NextResponse } from "next/server";
import {
    ACTIONS_CORS_HEADERS,
    createPostResponse,
    ActionGetResponse,
    ActionPostResponse
  } from "@solana/actions";
import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";
import clientPromise from "../mongodb"

const sleep = (ms: number | undefined) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

let origin = ""

async function waitForImage(prediction : any) {
    return new Promise(async (resolve, reject) => {
        try {
            while (
                prediction.status !== "succeeded" &&
                prediction.status !== "failed" ||
                prediction.output == null
            ) {
                await sleep(500);
                const response = await fetch(`${origin}/api/predictions/` + prediction.id);
                if (response.status !== 200) {
                    reject(new Error("Failed to fetch prediction"));
                    return;
                }
                prediction = await response.json();
                console.log({ prediction: prediction });
            }
            resolve(prediction);
        } catch (error) {
            reject(error);
        }
    });
}

async function streamToString(stream: any) {
    const chunks = [];
    for await (const chunk of stream) {
    chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

export async function POST(req: NextRequest) {
    try {
        const requestUrl = new URL(req.url);
        origin = requestUrl.origin

        const body = await streamToString(req.body)
        if (body.length == 0) {
            return new Response("Empty body", {
                status: 400,
                headers: ACTIONS_CORS_HEADERS,
            });
        }
        const decodedBody = JSON.parse(body)

        if (!decodedBody.signature) {
            return new Response("No tx signature", {
                status: 400,
                headers: ACTIONS_CORS_HEADERS,
            });
        }
        const txSig = decodedBody.signature

        if (!decodedBody.account){
            return new Response("Failed pub key validation", {
                status: 400,
                headers: ACTIONS_CORS_HEADERS,
            });
        }
        const toPubKey = decodedBody.account

        const params = req.nextUrl.searchParams.get('data') || ""
        const decodedParams = decodeURIComponent(params)
        if (decodedParams == "" || decodedParams == null){
            return new Response("No data param", {
                status: 400,
                headers: ACTIONS_CORS_HEADERS,
            });
        }
        const parsedBody = JSON.parse(decodedParams)
        console.log(txSig)

        let doesMemoExist = false
        const web3Connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_TOKEN}`)
        let timeoutCounter = 0

        while (doesMemoExist == false){
            await sleep(2000)
            console.log('called')
            const parsedTrans = await web3Connection.getParsedTransaction(
                txSig,
                { maxSupportedTransactionVersion: 0 }
            )
            if (parsedTrans != null){
                console.log(parsedTrans.transaction.message.instructions)
                parsedTrans.transaction.message.instructions.map(instruc => {
                    const instruction = instruc as { parsed?: string};
                    if (instruction.parsed && instruction.parsed == "imggenblink.xyz"){
                        doesMemoExist = true
                    }
                })
            }

            timeoutCounter++
            if (timeoutCounter >= 9){
                return new Response("Timed out checking tx sig", {
                    status: 400,
                    headers: ACTIONS_CORS_HEADERS,
                });
            }
        }

        if (!doesMemoExist) {
            return new Response("Not valid tx signature for this service", {
                status: 400,
                headers: ACTIONS_CORS_HEADERS,
            });
        } else {
            console.log("correct signature")
        }

        const client = await clientPromise;
        const db = client.db("imggenblink");
        const collection = db.collection("txSigs")
        const allSigs = await collection.find({}).toArray();

        if (allSigs.length > 0) {
            let sigExist = false
            allSigs[0].sigs.map((sig : String) => {
                if (sig == txSig){
                    sigExist = true
                    return
                }
            })
            if (sigExist) {
                return new Response("Already generated image", {
                    status: 400,
                    headers: ACTIONS_CORS_HEADERS,
                });
            }
            const query = { _id: allSigs[0]._id }; // Specify the document you want to update
            const update = {
              $push: { sigs: txSig } // Replace 'yourArrayField' and 'newElement' with your field name and value
            };
            const result = await collection.updateOne(query, update);
        }

        const baseHref = new URL(
            `/api/action?to=${toPubKey}`,
            origin,
          ).toString();

        const response = await axios.post(`${origin}/api/predictions`, {
            prompt: parsedBody[0]
        })

        let prediction = response.data

        let returnedSuccess = await waitForImage(prediction) as {output: Array<string>}

        console.log('ahsdas')
        console.log(returnedSuccess)

        const data = "asd"
        const test = {
            type: "action",
            icon: `${returnedSuccess.output[0]}`,
            title: `Your image has been generated!`,
            description: `${returnedSuccess.output[0]}`,
            label: "nft",
            links: {
                actions: [
                    {
                      label: 'Mint as NFT?', // button text
                      href: `${baseHref}&prompt=${parsedBody[0]}&email=${parsedBody[1]}`, // this href will have a text input
                      parameters: [
                        {
                          name: "amount", // field name
                          label: "Enter a custom SOL amount", // text input placeholder
                        },
                      ],
                    },
                    {
                        label: 'Generate again? ($0.10 USDC)', // button text
                        href: `${baseHref}&prompt=${parsedBody[0]}&email=${parsedBody[1]}`, // this href will have a text input
                    },
                ]
            },
          };
        return new Response(JSON.stringify(test), {
            status: 201,
            headers: ACTIONS_CORS_HEADERS
        })
    } catch (err) {
      console.log("Error in POST /api", err);
      let message = "An unknown error occurred";
      if (typeof err == "string") message = err;
      return new Response(message, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  }
  