import { NextRequest, NextResponse } from "next/server";
import {
    ACTIONS_CORS_HEADERS,
    createPostResponse,
    ActionGetResponse,
    ActionPostResponse
  } from "@solana/actions";
import axios from "axios";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import clientPromise from "../../../mongodb"
import { checkPrediction, genImgPrediction } from "@/app/imgGen";
import {Prediction} from "replicate";
import { Resend } from "resend";
import { USE_DEV } from "@/consts";

const sleep = (ms: number | undefined) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

let origin = ""

function isPrediction(result: any): result is [boolean, Prediction] {
    return result[1] && typeof result[1] === 'object' && 'status' in result[1];
}

async function waitForImage(prediction : [boolean, Prediction]) : Promise<[boolean, Prediction]> {
    return new Promise(async (resolve, reject) => {
        try {
            while (
                prediction[1].status !== "succeeded" &&
                prediction[1].status !== "failed" ||
                prediction[1].output == null
            ) {
                await sleep(500);
                console.log("waitForImage")
                console.log(`waitForImage: ${prediction[1]}`)
                const result = await checkPrediction(prediction[1].id)

                if (isPrediction(result)) {
                    prediction = result;
                } else {
                    resolve([false, prediction[1]]);
                    return;
                }
            }
            console.log("waitForImage resolve")
            console.log(prediction[1])
            resolve([true, prediction[1]]);
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

async function sendEmail(email: string, imgURL: string) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    try {
        const { data, error } = await resend.emails.send({
          from: 'Img Gen Blink <sender@imggenblink.xyz>',
          to: [`${email}`],
          subject: 'Your AI generated image via Solana blink',
          html:`<div>
                <img src=${imgURL} alt="Image" />
                <p>${imgURL}</p>
            </div>`
        });
    
        if (error) {
          return error
        }
    
        return true

    } catch (error) {
        return error
    }
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

        let web3Connection : Connection 
        if (USE_DEV) {
            web3Connection = (process.env.HELIUS_API_TOKEN != "") ? 
                new Connection(`https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_TOKEN}`) : 
                new Connection(clusterApiUrl("devnet"), "confirmed");
        } else {
            web3Connection = (process.env.HELIUS_API_TOKEN != "") ? 
                new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_TOKEN}`) : 
                new Connection(clusterApiUrl("mainnet-beta"));
        }

        let timeoutCounter = 0

        while (doesMemoExist == false){
            await sleep(2000)
            console.log('called')
            const parsedTrans = await web3Connection.getParsedTransaction(
                txSig,
                { maxSupportedTransactionVersion: 0, commitment: "confirmed" }
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
            `/api/action?`,
            origin,
        ).toString();


        let prediction = await genImgPrediction(parsedBody[0])
        console.log("prediction")
        console.log(prediction)
        console.log("------")
        if (prediction[0] == false){
            return new Response(prediction[1] as string, {
                status: 400,
                headers: ACTIONS_CORS_HEADERS,
            });
        }

        let [returnedSuccess, returnedPrediction] = await waitForImage(prediction)

        if (returnedSuccess == false) {
            const generateAgainOnError = {
                type: "action",
                icon: `${requestUrl.origin}/robot-artist.jpg`,
                title: `There was an error generating your image..`,
                description: `${returnedPrediction}`,
                label: "nft",
                links: {
                    actions: [
                        {
                            label: 'Generate again? ($0.10 USDC)', // button text
                            href: `${baseHref}prompt=${parsedBody[0]}&email=${parsedBody[1]}`, // this href will have a text input
                        },
                    ]
                },
            };

            return new Response(JSON.stringify(generateAgainOnError), {
                status: 201,
                headers: ACTIONS_CORS_HEADERS
            })
        }

        console.log('ahsdas')
        console.log(returnedPrediction)

        if (parsedBody[1] != ""){
            const emailResponse = await sendEmail(parsedBody[1], returnedPrediction.output[0])

            if (emailResponse != true) { 
                return new Response(`${emailResponse}`, {
                    status: 400,
                    headers: ACTIONS_CORS_HEADERS,
                });
            }
        }

        const data = "asd"
        const test = {
            type: "action",
            icon: `${returnedPrediction.output[0]}`,
            title: `Your image has been generated!`,
            description: `${returnedPrediction.output[0]}`,
            label: "pumpfunToken",
            links: {
                actions: [
                    {
                      label: 'Create Pump.Fun token?', // button text
                      href: `${origin}/api/action/createCollection?minter=${toPubKey}&imgURL=${encodeURIComponent(returnedPrediction.output[0])}&name={name}&ticker={ticker}&desc={desc}&x={x}&tg={tg}&web={web}`, // this href will have a text input
                      parameters: [
                        {
                          name: "name", // field name
                          label: "Enter token name", // text input placeholder
                          required: true
                        },
                        {
                            name: "ticker", // field name
                            label: "Enter token ticker", // text input placeholder
                            required: true
                        },
                        {
                            name: "desc", // field name
                            label: "Token description", // text input placeholder
                            required: true
                        },
                        {
                            name: "x", // field name
                            label: "X profile (optional)", // text input placeholder
                            required: false
                        },
                        {
                            name: "tg", // field name
                            label: "Telegram (optional)", // text input placeholder
                            required: false
                        },
                        {
                            name: "web", // field name
                            label: "Website (optional)", // text input placeholder
                            required: false
                        },
                      ],
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
  